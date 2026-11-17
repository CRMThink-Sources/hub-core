import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { spaEffectJobOptions } from './spa-effect-job-options'
import { apiLogger } from '@/shared/infra/logger'

export const SPA_ITEM_RESOURCE_SYNC = 'spa-item-resource-sync'

/**
 * Quem pediu o efeito. `spa-webhook` é o evento da SPA, que chega igual a produção e a
 * homologação — e que só o ambiente com `providerEffectsEnabled` executa. `app` é o
 * próprio ambiente agindo sobre um recurso dele (`DeleteLine`), e roda sempre.
 *
 * Ausente é job enfileirado antes deste campo existir, e é tratado como
 * `spa-webhook`: antes dele, só o webhook enfileirava sem `deletedBy`.
 */
export type SpaEffectSource = 'spa-webhook' | 'app'

export type SpaItemResourceSyncJob = {
  /** Id do item na SPA 1146, como vem em `data[FIELDS][ID]`. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
  source?: SpaEffectSource
  /**
   * Quem e quando excluiu — só o job de limpeza (`SPA_ITEM_CLEANUP_JOB`) carrega
   * isto, vindo de `DeleteLine`. Ausente no job de status-sync, que não tem "quem
   * excluiu" (a edição pode ter vindo de qualquer lugar, inclusive o próprio CRM).
   * Opcionais aqui, e não num tipo à parte, para os dois jobs continuarem
   * compartilhando a mesma fila e o mesmo shape de payload.
   */
  deletedBy?: string
  deletedAt?: string
}

/** Reconciliação da cobrança de todas as linhas de uma assinatura da SPA 1142. */
export type SubscriptionBillingSyncJob = {
  /** Id do item na SPA 1142. */
  subscriptionId: string
  traceKey: string
  source?: SpaEffectSource
}

/** Os nomes de job da fila. O processor é escolhido por eles. */
export const SPA_ITEM_CLEANUP_JOB = 'cleanup-deleted-item'
export const SPA_ITEM_STATUS_JOB = 'sync-item-status'
export const SUBSCRIPTION_BILLING_SYNC_JOB = 'sync-subscription-billing'

/**
 * `true` quando o job não deve rodar neste ambiente: veio do webhook da SPA e os
 * efeitos de provider estão desligados. Defesa em profundidade da guarda do controller,
 * para o que já estava enfileirado antes da flag.
 */
export const isDisabledSpaEffect = (
  source: SpaEffectSource | undefined,
  providerEffectsEnabled: boolean,
): boolean =>
  !providerEffectsEnabled && (source ?? 'spa-webhook') === 'spa-webhook'

/**
 * Fila da reconciliação entre o item da SPA 1146 e o recurso remoto dele: limpeza do
 * item apagado e sincronização de status do item editado.
 *
 * **Uma fila para os efeitos de item e de assinatura**, com id de deduplicação distinto
 * por efeito: o prefixo distinto é o que impede o update de um item de colapsar com o
 * delete dele. Ver `spaEffectJobOptions`.
 */
export const spaItemResourceSyncQueue = new Queue<
  SpaItemResourceSyncJob | SubscriptionBillingSyncJob
>(SPA_ITEM_RESOURCE_SYNC, bullBaseOptions)

/** Ids de deduplicação por item e por efeito. */
export const spaItemCleanupJobId = (itemId: string): string =>
  `spa-item-cleanup-${itemId}`

export const spaItemStatusJobId = (itemId: string): string =>
  `spa-item-status-${itemId}`

export const subscriptionBillingSyncJobId = (subscriptionId: string): string =>
  `spa-subscription-billing-${subscriptionId}`

/**
 * Enfileira a limpeza do recurso de um item apagado.
 *
 * A deduplicação só colapsa a reentrega enquanto o job está pendente. A guarda contra
 * desassinar duas vezes é a marca no espelho do recurso, dentro do caso de uso.
 */
export async function enqueueSpaItemCleanupJob(job: SpaItemResourceSyncJob) {
  const created = await spaItemResourceSyncQueue.add(
    SPA_ITEM_CLEANUP_JOB,
    job,
    spaEffectJobOptions(spaItemCleanupJobId(job.itemId)),
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: created.id,
      itemId: job.itemId,
      traceKey: job.traceKey,
      ...(job.deletedBy !== undefined && { deletedBy: job.deletedBy }),
      ...(job.deletedAt !== undefined && { deletedAt: job.deletedAt }),
    },
    'Limpeza do recurso de item apagado enfileirada',
  )

  return created
}

/**
 * Enfileira a sincronização de status do recurso de um item editado.
 *
 * Toda edição de qualquer campo do item gera um evento, inclusive as escritas da própria
 * API: a rajada no mesmo item vira um job pendente, e o que chega durante a execução roda
 * depois dela.
 */
export async function enqueueSpaItemStatusSyncJob(job: SpaItemResourceSyncJob) {
  const created = await spaItemResourceSyncQueue.add(
    SPA_ITEM_STATUS_JOB,
    job,
    spaEffectJobOptions(spaItemStatusJobId(job.itemId)),
  )

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

/**
 * Enfileira a reconciliação de cobrança das linhas de uma assinatura editada.
 *
 * Mesma deduplicação da sincronização de status: o UPDATE da 1142 também é ruidoso — o
 * gateway grava status e período nela.
 */
export async function enqueueSubscriptionBillingSyncJob(
  job: SubscriptionBillingSyncJob,
) {
  const created = await spaItemResourceSyncQueue.add(
    SUBSCRIPTION_BILLING_SYNC_JOB,
    job,
    spaEffectJobOptions(subscriptionBillingSyncJobId(job.subscriptionId)),
  )

  apiLogger.debug(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: created.id,
      subscriptionId: job.subscriptionId,
      traceKey: job.traceKey,
    },
    'Cobrança das linhas da assinatura enfileirada',
  )

  return created
}
