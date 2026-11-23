import {
  defaultDashboardQuery,
  defaultTodayQuery,
} from '@/modules/thinkzap/application/insights/default-queries'
import {
  insightsQueryHash,
  type InsightsKind,
} from '@/modules/thinkzap/application/insights/insights-keys'
import {
  STALE_MAX_MS,
  TTL_BY_KIND,
  type InsightsResultStore,
} from '@/modules/thinkzap/application/insights/insights-result-store'
import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import { INSIGHTS_PREWARM_EVERY_MS } from '@/queue/insights-prewarm.queue'
import { workerLogger } from '@/shared/infra/logger'

const log = workerLogger.child({ queue: 'insights-compute', job: 'prewarm' })

export type InsightsPrewarmDeps = {
  store: Pick<InsightsResultStore, 'listRecentlyOpened' | 'getResult'>
  getConfig: (appId: string) => Promise<InsightsConfig>
  enqueue: (job: InsightsComputeJob) => Promise<unknown>
  now?: () => number
  tickMs?: number
}

const KINDS: InsightsKind[] = ['today', 'dashboard']

/**
 * Pré-aquecimento: para cada app que abriu o Insights nos últimos 7 dias,
 * garante que o "Agora" e o Desempenho do período padrão tenham resultado
 * servível, de modo que a abertura típica encontre o painel pronto.
 *
 * Só recalcula o que **vai sair da janela servível antes do próximo tick** (ou
 * já saiu). Recalcular a cada tick refaria toda a leitura de hoje e ontem, por
 * app, a cada 10 minutos; o resultado vencido ainda é servido (e recalculado na
 * abertura), então o pré-aquecimento só precisa impedir que ele suma.
 *
 * Os jobs entram com prioridade baixa e **sem marcar "calculando"** nem deixar
 * falha registrada: quem abre a tela passa na frente, e uma falha aqui não vira
 * erro para ninguém (ver `processInsightsCompute`). A fila tem concorrência 1,
 * então os apps são calculados um por vez. Falha de um app não impede os demais.
 */
export async function processInsightsPrewarm(
  deps: InsightsPrewarmDeps,
): Promise<{ apps: number; enqueued: number }> {
  const now = deps.now ?? Date.now
  const tickMs = deps.tickMs ?? INSIGHTS_PREWARM_EVERY_MS
  const apps = await deps.store.listRecentlyOpened()
  let enqueued = 0

  for (const appId of apps) {
    try {
      const cfg = await deps.getConfig(appId)
      const queries: Record<InsightsKind, Record<string, unknown>> = {
        dashboard: defaultDashboardQuery(now()),
        today: defaultTodayQuery(cfg.refMin),
      }
      for (const kind of KINDS) {
        const query = queries[kind]
        const result = await deps.store.getResult(
          appId,
          kind,
          insightsQueryHash(kind, query),
        )
        const expiresInTick =
          result !== null &&
          now() - result.computedAt + tickMs >= TTL_BY_KIND[kind] + STALE_MAX_MS
        if (result !== null && !expiresInTick) continue

        await deps.enqueue({
          kind,
          appId,
          query,
          origin: 'prewarm',
          traceKey: `prewarm-${appId}`,
        })
        enqueued += 1
      }
    } catch (error) {
      // Um app com problema (configuração ilegível, Redis momentaneamente fora)
      // não pode impedir o pré-aquecimento dos outros.
      log.warn(
        {
          app: 'thinkzap',
          appId,
          errorName: error instanceof Error ? error.name : 'unknown',
        },
        'Pré-aquecimento do Insights falhou para um app; seguindo com os demais',
      )
    }
  }

  log.info(
    { app: 'thinkzap', apps: apps.length, enqueued },
    'Pré-aquecimento do Insights agendado',
  )
  return { apps: apps.length, enqueued }
}
