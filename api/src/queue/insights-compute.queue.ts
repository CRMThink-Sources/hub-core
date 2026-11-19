import { Queue } from 'bullmq'
import {
  insightsQueryHash,
  type InsightsKind,
} from '@/modules/thinkzap/application/insights/insights-keys'
import { bullBaseOptions } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const INSIGHTS_COMPUTE = 'insights-compute'

/** Cálculo de um painel (Desempenho ou Agora) de um app. */
export const INSIGHTS_COMPUTE_JOB = 'compute'

export type InsightsComputeJob = {
  kind: InsightsKind
  appId: string
  /** Consulta como a API a recebeu (já validada). O worker não a reinterpreta. */
  query: Record<string, unknown>
  /** Correlação com a requisição ou com o pré-aquecimento que originou o job. */
  traceKey?: string
  /**
   * `prewarm`: calculado por antecipação, sem ninguém esperando. Roda depois dos
   * pedidos de usuário e, se falhar, não deixa erro para a tela (ver o processor).
   */
  origin?: 'request' | 'prewarm'
}

/** Tick do job repetível que agenda o pré-aquecimento (ver `insights-prewarm.queue.ts`). */
export type InsightsPrewarmTickJob = { tick: true }

/** Tudo o que trafega na fila: cálculos de painel e o tick do pré-aquecimento. */
export type InsightsQueueJob = InsightsComputeJob | InsightsPrewarmTickJob

/**
 * Prioridade do BullMQ: número menor roda antes, e job sem prioridade roda antes
 * de qualquer job com prioridade. Pedido de usuário não tem prioridade; o
 * pré-aquecimento tem, para um app que ninguém abriu não atrasar quem abriu.
 */
export const PREWARM_PRIORITY = 10

/**
 * Fila dos cálculos do Insights, consumida por `worker:insights`. O cálculo lê
 * centenas de conversas no Bitrix/Vibe e leva minutos: por isso roda aqui, e não
 * dentro da requisição HTTP.
 */
export const insightsComputeQueue = new Queue<InsightsQueueJob>(
  INSIGHTS_COMPUTE,
  bullBaseOptions,
)

/**
 * Id determinístico por app + painel + consulta: o BullMQ colapsa `add` de mesmo
 * id enquanto o job existe, e é isso que garante um único cálculo por consulta
 * mesmo com várias instâncias da API pedindo ao mesmo tempo. Separador `-`,
 * nunca `:` (o BullMQ recusa id custom com dois-pontos).
 */
export const insightsComputeJobId = (
  kind: InsightsKind,
  appId: string,
  query: Record<string, unknown>,
): string =>
  `${kind}-${appId.replace(/:/g, '-')}-${insightsQueryHash(kind, query)}`

/**
 * `removeOnComplete` **e** `removeOnFail` é o que torna o `jobId` fixo seguro: o
 * BullMQ ignora um `add` cujo id já existe em qualquer estado, então um job
 * concluído ou falho retido faria o próximo cálculo da mesma consulta ser
 * descartado em silêncio — e a tela esperaria 15 min por um job que não existe.
 * Por isso o falho também não fica retido (o diagnóstico está no log do worker).
 * `attempts: 1`: quem refaz é a próxima abertura — repetir sozinho multiplicaria
 * minutos de leitura na Vibe API.
 */
const OPTIONS = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: true,
}

export async function enqueueInsightsCompute(job: InsightsComputeJob) {
  const prewarm = job.origin === 'prewarm'
  const created = await insightsComputeQueue.add(INSIGHTS_COMPUTE_JOB, job, {
    ...OPTIONS,
    jobId: insightsComputeJobId(job.kind, job.appId, job.query),
    ...(prewarm ? { priority: PREWARM_PRIORITY } : {}),
  })

  // O mesmo `jobId` colapsa no job que já existia. Se ele era um pré-aquecimento
  // esperando na fila e agora um usuário pediu a mesma consulta, ele sobe para a
  // frente: quem abriu a tela não espera atrás dos pré-aquecimentos dos outros.
  if (!prewarm && created.opts?.priority) {
    await created.changePriority({ priority: 0 }).catch((e: unknown) => {
      // Já em execução ou concluído: não há fila a furar.
      apiLogger.debug(
        { queue: INSIGHTS_COMPUTE, jobId: created.id, err: String(e) },
        'Insights: job do pré-aquecimento não pôde subir de prioridade',
      )
    })
  }

  apiLogger.debug(
    {
      app: 'thinkzap',
      queue: INSIGHTS_COMPUTE,
      jobId: created.id,
      kind: job.kind,
      appId: job.appId,
      traceKey: job.traceKey,
    },
    'Cálculo do Insights enfileirado',
  )

  return created
}
