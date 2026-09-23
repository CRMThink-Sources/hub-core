import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const THINKZAP_LINE_CONNECTED_SYNC = 'thinkzap-line-connected-sync'

/**
 * Fila da gravação de `UF_CRM_93_CONNECTED` no item da linha a cada evento de
 * conexão/desconexão dos providers.
 *
 * Separada de `thinkzap-connection-events` de propósito: o aviso aos destinatários
 * encerra cedo sem destinatário ou sem `Instance`, e retenta por falha de
 * `im.notify` — nenhum dos dois pode decidir se o CRM é atualizado. Dois jobs,
 * falhas independentes.
 *
 * `remoteId` é o `instanceId` da Z-API ou o `channelId` da HubMessage.
 */
export type ThinkzapLineConnectedSyncJob = {
  provider: 'ZAPI' | 'HUBMESSAGE'
  remoteId: string
  event: 'connected' | 'disconnected'
  momment: number
}

export const thinkzapLineConnectedSyncQueue =
  new Queue<ThinkzapLineConnectedSyncJob>(
    THINKZAP_LINE_CONNECTED_SYNC,
    bullBaseOptions,
  )

/** Determinístico: reentrega do mesmo evento pelo provider colapsa no mesmo job. */
export function lineConnectedSyncJobId(
  job: ThinkzapLineConnectedSyncJob,
): string {
  return `line-connected-${job.provider}-${job.remoteId}-${job.event}-${job.momment}`
}

export async function enqueueThinkzapLineConnectedSync(
  job: ThinkzapLineConnectedSyncJob,
) {
  const createdJob = await thinkzapLineConnectedSyncQueue.add(
    'sync-line-connected',
    job,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      jobId: lineConnectedSyncJobId(job),
    },
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_LINE_CONNECTED_SYNC,
      jobId: createdJob.id,
      provider: job.provider,
      event: job.event,
      remoteId: job.remoteId,
    },
    'Line connected sync job enqueued',
  )

  return createdJob
}
