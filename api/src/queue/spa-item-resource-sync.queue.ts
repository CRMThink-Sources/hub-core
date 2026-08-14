import { Queue } from 'bullmq'
import { redisConnection } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const SPA_ITEM_RESOURCE_SYNC = 'spa-item-resource-sync'

export type SpaItemResourceSyncJob = {
  /** Id do item na SPA 1146, como vem em `data[FIELDS][ID]`. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
}

/** Os dois nomes de job da fila. O processor é escolhido por eles. */
export const SPA_ITEM_CLEANUP_JOB = 'cleanup-deleted-item'
export const SPA_ITEM_STATUS_JOB = 'sync-item-status'

/**
 * Fila da reconciliação entre o item da SPA 1146 e o recurso remoto dele: limpeza do
 * item apagado e sincronização de status do item editado.
 *
 * **Fila própria, não a `spa-item-provisioning`.** O motivo é mecânico: o `jobId` de lá
 * é `spa-item-provision-<itemId>`, determinístico por item, e o BullMQ colapsa jobs de
 * mesmo id enquanto eles estão na fila ou retidos no histórico de concluídos. Um item
 * criado e apagado no mesmo minuto — o caso de quem errou o provider e refez — teria a
 * limpeza colapsada com o provisionamento, ou o contrário.
 *
 * **Uma fila para os dois efeitos**, com `jobId` distinto por efeito: os dois falam do
 * mesmo assunto e competem pelo mesmo tipo de recurso (uma leitura de SPA mais uma
 * chamada de provider). O prefixo distinto é o que garante que o update de um item não
 * colapse com o delete dele.
 */
export const spaItemResourceSyncQueue = new Queue<SpaItemResourceSyncJob>(
  SPA_ITEM_RESOURCE_SYNC,
  { connection: redisConnection },
)

/**
 * Ids determinísticos por item e por efeito.
 *
 * Separador `-`, **nunca** `:`: o BullMQ recusa id custom com dois-pontos
 * (`Custom Id cannot contain :`), porque é o separador das chaves dele no Redis. O erro
 * só aparece na chamada de `add`, então a única forma de travá-lo é aqui.
 */
export const spaItemCleanupJobId = (itemId: string): string =>
  `spa-item-cleanup-${itemId}`

export const spaItemStatusJobId = (itemId: string): string =>
  `spa-item-status-${itemId}`

const OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
}

/**
 * Enfileira a limpeza do recurso de um item apagado.
 *
 * `jobId` determinístico: reentrega do mesmo delete pelo Bitrix — que acontece, e é o
 * comportamento dele quando o handler demora — é colapsada pelo BullMQ. A colapsagem
 * não é a única defesa contra desassinar duas vezes: a guarda real é a marca no espelho
 * do recurso, verificada dentro do caso de uso, porque um evento reentregue dias depois
 * teria id livre de novo.
 */
export async function enqueueSpaItemCleanupJob(job: SpaItemResourceSyncJob) {
  const created = await spaItemResourceSyncQueue.add(
    SPA_ITEM_CLEANUP_JOB,
    job,
    { ...OPTIONS, jobId: spaItemCleanupJobId(job.itemId) },
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: created.id,
      itemId: job.itemId,
      traceKey: job.traceKey,
    },
    'Limpeza do recurso de item apagado enfileirada',
  )

  return created
}

/**
 * Enfileira a sincronização de status do recurso de um item editado.
 *
 * Aqui a colapsagem por `jobId` **é** a defesa que importa contra volume: toda edição de
 * qualquer campo do item gera um evento, incluindo as escritas da própria API. Rajada no
 * mesmo item vira um job; o que ela não colapsa é rajada em itens distintos, e é para
 * isso que a fila existe em vez de o efeito rodar no handler.
 */
export async function enqueueSpaItemStatusSyncJob(job: SpaItemResourceSyncJob) {
  const created = await spaItemResourceSyncQueue.add(SPA_ITEM_STATUS_JOB, job, {
    ...OPTIONS,
    jobId: spaItemStatusJobId(job.itemId),
  })

  apiLogger.debug(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: created.id,
      itemId: job.itemId,
      traceKey: job.traceKey,
    },
    'Sincronização de status do item enfileirada',
  )

  return created
}
