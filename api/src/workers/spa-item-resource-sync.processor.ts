import { makeCleanupDeletedSpaItemLine } from '@/modules/thinkzap/main/make-cleanup-deleted-spa-item-line'
import { makeSyncSpaItemResourceStatus } from '@/modules/thinkzap/main/make-sync-spa-item-resource-status'
import {
  SPA_ITEM_RESOURCE_SYNC,
  type SpaItemResourceSyncJob,
} from '@/queue/spa-item-resource-sync.queue'
import { workerLogger } from '@/shared/infra/logger'

/**
 * `workerLogger` direto, e não `createWorkerSourceLogger`: `WorkerSource` nomeia de qual
 * provider a **mensagem** chegou (`z-api`, `bitrix`, `hubmessage`), e estes jobs não
 * processam mensagem nenhuma.
 */
const log = workerLogger.child({ queue: SPA_ITEM_RESOURCE_SYNC })

/**
 * Limpa o recurso remoto de um item apagado na SPA 1146.
 *
 * A fábrica é chamada **por job**, e não uma vez no módulo, pelo mesmo motivo dos outros
 * processors: ela monta cliente HTTP e decorators de cache, e prender uma instância no
 * escopo do módulo faria a conexão viver enquanto o worker vive — sem que nada a
 * reconstrua se a credencial do portal interno mudar.
 */
export async function processSpaItemCleanup(
  job: SpaItemResourceSyncJob,
): Promise<void> {
  const result = await makeCleanupDeletedSpaItemLine().execute({
    itemId: job.itemId,
    traceKey: job.traceKey,
    deletedBy: job.deletedBy,
    deletedAt: job.deletedAt,
  })

  log.info(
    {
      app: 'thinkzap',
      itemId: job.itemId,
      traceKey: job.traceKey,
      outcome: result.outcome,
      billingAdjusted: result.billingAdjusted,
      ...(job.deletedBy !== undefined && { deletedBy: job.deletedBy }),
      ...(job.deletedAt !== undefined && { deletedAt: job.deletedAt }),
    },
    'Limpeza do recurso de item apagado concluída',
  )
}

/**
 * Reconcilia o ciclo de cobrança do recurso com o status do item.
 *
 * O log de desfecho sai em `debug`, não `info`: este job roda a **cada** edição de campo
 * do item, e a esmagadora maioria termina em `noop`. O que merece `info` — desassinou,
 * reassinou — o caso de uso já registra.
 */
export async function processSpaItemStatusSync(
  job: SpaItemResourceSyncJob,
): Promise<void> {
  const result = await makeSyncSpaItemResourceStatus().execute({
    itemId: job.itemId,
    traceKey: job.traceKey,
  })

  log.debug(
    {
      app: 'thinkzap',
      itemId: job.itemId,
      traceKey: job.traceKey,
      outcome: result.outcome,
    },
    'Sincronização de status do item concluída',
  )
}
