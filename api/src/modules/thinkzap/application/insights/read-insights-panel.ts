import { InsightsReadFailedError } from '@/modules/thinkzap/domain/errors/insights-read-failed.error'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import { apiLogger } from '@/shared/infra/logger'
import { insightsQueryHash, type InsightsKind } from './insights-keys'
import {
  MAX_COMPUTE_MS,
  type InsightsResultStore,
} from './insights-result-store'

/** Quanto tempo o app fica marcado como "usado recentemente" (pré-aquecimento). */
export const LAST_OPEN_TTL_MS = 7 * 24 * 3600e3

/**
 * Resposta de uma consulta de painel:
 * - `ready`: o painel (`stale` = vencido, servido enquanto um novo cálculo roda);
 * - `computing`: ainda não há resultado; o cálculo está em andamento.
 */
export type PanelResponse<T> =
  | { status: 'ready'; data: T; stale: boolean }
  | { status: 'computing'; startedAt: number }

export type InsightsPanelReaderDeps = {
  store: Pick<
    InsightsResultStore,
    'getResult' | 'getState' | 'markComputing' | 'clearState' | 'touchLastOpen'
  >
  enqueue: (job: InsightsComputeJob) => Promise<unknown>
  now?: () => number
}

/**
 * Entrega um painel sem esperar o cálculo: devolve o resultado guardado ou
 * dispara o cálculo em segundo plano e diz "calculando". Quem calcula é o worker
 * (`processInsightsCompute`); aqui só se lê, se enfileira e se conta o prazo.
 *
 * Pedidos simultâneos da mesma consulta compartilham um cálculo: o `jobId` da
 * fila é determinístico e o BullMQ colapsa o `add` repetido.
 */
export class InsightsPanelReader {
  private readonly now: () => number

  constructor(private readonly deps: InsightsPanelReaderDeps) {
    this.now = deps.now ?? Date.now
  }

  async read<T>(
    kind: InsightsKind,
    appId: string,
    query: Record<string, unknown>,
    traceKey?: string,
  ): Promise<PanelResponse<T>> {
    const hash = insightsQueryHash(kind, query)
    const job: InsightsComputeJob = { kind, appId, query, traceKey }
    await this.markOpened(appId)

    const result = await this.deps.store.getResult<T>(appId, kind, hash)
    if (result) {
      // Vencido: serve o antigo na hora e recalcula em segundo plano. Falha do
      // recálculo não pode estragar a resposta que já temos.
      if (!result.fresh) {
        await this.ensureComputing(job, hash).catch((e: unknown) =>
          apiLogger.warn(
            { errorName: e instanceof Error ? e.name : 'unknown', kind },
            'Insights: não foi possível enfileirar o recálculo',
          ),
        )
      }
      return { status: 'ready', data: result.value, stale: !result.fresh }
    }

    const state = await this.ensureComputing(job, hash)
    return { status: 'computing', startedAt: state.startedAt }
  }

  /**
   * Garante um cálculo em andamento e devolve o estado dele. Falha registrada
   * ou prazo estourado: a primeira consulta depois delas recebe o erro (e o
   * estado é limpo, para a abertura seguinte tentar de novo).
   */
  private async ensureComputing(
    job: InsightsComputeJob,
    hash: string,
  ): Promise<{ startedAt: number }> {
    const { store } = this.deps
    const { kind, appId } = job
    const state = await store.getState(appId, kind, hash)

    if (state?.status === 'failed') {
      await store.clearState(appId, kind, hash)
      throw new InsightsReadFailedError('failed')
    }
    if (state?.status === 'computing') {
      if (this.now() - state.startedAt > MAX_COMPUTE_MS) {
        await store.clearState(appId, kind, hash)
        throw new InsightsReadFailedError('timeout')
      }
      return { startedAt: state.startedAt }
    }

    const started = await store.markComputing(appId, kind, hash)
    try {
      await this.deps.enqueue(job)
    } catch (e) {
      // Sem job, o "calculando" não terminaria nunca: desfaz a marca.
      await store.clearState(appId, kind, hash).catch(() => undefined)
      throw e
    }
    return { startedAt: started.startedAt }
  }

  // Alimenta o pré-aquecimento. Redis lento ou fora do ar não pode atrasar nem
  // derrubar a abertura do painel.
  private async markOpened(appId: string): Promise<void> {
    try {
      await this.deps.store.touchLastOpen(appId, LAST_OPEN_TTL_MS)
    } catch (e) {
      apiLogger.warn(
        { errorName: e instanceof Error ? e.name : 'unknown' },
        'Insights: não foi possível registrar a abertura do app',
      )
    }
  }
}
