import { buildDashboard } from '@/modules/thinkzap/application/insights/build-dashboard'
import { buildToday } from '@/modules/thinkzap/application/insights/build-today'
import { insightsQueryHash } from '@/modules/thinkzap/application/insights/insights-keys'
import type { InsightsResultStore } from '@/modules/thinkzap/application/insights/insights-result-store'
import type {
  DashboardQuery,
  DashboardResult,
  TodayQuery,
  TodayResult,
} from '@/modules/thinkzap/application/insights/insights-results.types'
import {
  runWithSourceFallback,
  type InsightsSourceFailureHandler,
  type InsightsSourceResolver,
} from '@/modules/thinkzap/application/insights/resolve-insights-source'
import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import { workerLogger } from '@/shared/infra/logger'

const log = workerLogger.child({ queue: 'insights-compute' })

export type InsightsComputeDeps = {
  store: Pick<
    InsightsResultStore,
    'getGeneration' | 'setResult' | 'markFailed' | 'clearState'
  >
  getConfig: (appId: string) => Promise<InsightsConfig>
  /**
   * Fonte nova a cada job. O resolver do processo da API guarda a fonte por app
   * em memória, e a invalidação feita lá (salvar a chave) não alcançaria este
   * processo: reaproveitar a fonte serviria o modo antigo depois da troca.
   */
  makeSources: () => {
    resolve: InsightsSourceResolver
    onSourceFailure: InsightsSourceFailureHandler
  }
  now?: () => number
}

/**
 * Calcula um painel e o guarda para a API entregar. Roda fora da requisição:
 * leva minutos com o cache frio.
 *
 * A **geração** do app é lida antes de qualquer leitura. Se a configuração ou a
 * chave mudar durante o cálculo, o resultado volta descartado (não é guardado):
 * foi calculado com a regra antiga. Falha marca o estado como `failed` — a
 * próxima consulta da tela recebe o erro em vez de esperar para sempre — e
 * relança, para o BullMQ registrar o job como falho. (Menos no pré-aquecimento,
 * que não tem tela esperando: ali só o log e o BullMQ registram.)
 */
export async function processInsightsCompute(
  job: InsightsComputeJob,
  deps: InsightsComputeDeps,
): Promise<{ stored: boolean }> {
  const now = deps.now ?? Date.now
  const { kind, appId, query, traceKey } = job
  const hash = insightsQueryHash(kind, query)
  const startedAt = now()
  const fields = { app: 'thinkzap', kind, appId, traceKey }

  let generation = await deps.store.getGeneration(appId)
  const sources = deps.makeSources()

  // Chave revogada no meio do cálculo: o resolver invalida o app (o que muda a
  // geração por conta própria) e o cálculo é refeito pelo REST clássico. Essa
  // mudança é nossa, não uma configuração salva por outra pessoa: a geração
  // passa a ser a nova, senão o resultado certo seria descartado.
  const onSourceFailure: InsightsSourceFailureHandler = async (id, error) => {
    // A chave foi regravada (ou a configuração mudou) enquanto este cálculo
    // usava a antiga: a recusa dela não diz nada sobre a chave nova, e marcá-la
    // como revogada deixaria o app no REST clássico por horas.
    if ((await deps.store.getGeneration(appId)) !== generation) return false
    const handled = await sources.onSourceFailure(id, error)
    if (handled) generation = await deps.store.getGeneration(appId)
    return handled
  }

  try {
    const cfg = await deps.getConfig(appId)
    const result = await runWithSourceFallback<DashboardResult | TodayResult>(
      appId,
      { resolveSource: sources.resolve, onSourceFailure },
      source =>
        kind === 'dashboard'
          ? buildDashboard(source, cfg, query as DashboardQuery)
          : buildToday(source, cfg, query as TodayQuery),
    )
    const stored = await deps.store.setResult(
      appId,
      kind,
      hash,
      result,
      generation,
    )
    // Só limpa o estado quando o resultado foi guardado. Descartado por
    // invalidação, a própria invalidação já apagou o estado, e uma abertura
    // posterior pode ter marcado um "calculando" novo que não é nosso.
    if (stored) await deps.store.clearState(appId, kind, hash)
    log.info(
      {
        ...fields,
        outcome: stored ? 'stored' : 'discarded_invalidated',
        durationMs: now() - startedAt,
      },
      stored
        ? 'Cálculo do Insights concluído'
        : 'Cálculo do Insights descartado: o app foi invalidado durante a leitura',
    )
    return { stored }
  } catch (error) {
    // Só o nome: a mensagem do erro pode carregar dado do portal.
    log.warn(
      {
        ...fields,
        outcome: 'failed',
        errorName: error instanceof Error ? error.name : 'unknown',
        durationMs: now() - startedAt,
      },
      'Cálculo do Insights falhou',
    )
    // Pré-aquecimento não tem ninguém esperando: deixar a falha registrada faria
    // a próxima pessoa a abrir a tela receber um erro que ela não causou.
    // Também não marca se o app foi invalidado durante o cálculo: o estado já foi
    // apagado e a falha é de uma configuração que não vale mais.
    if (
      job.origin !== 'prewarm' &&
      (await deps.store.getGeneration(appId)) === generation
    ) {
      await deps.store.markFailed(appId, kind, hash)
    }
    throw error
  }
}
