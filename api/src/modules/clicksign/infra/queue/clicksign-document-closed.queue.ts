import { Queue } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import type { WebhookPayload } from '../../application/handle-signature-event.use-case'

export const CLICKSIGN_DOCUMENT_CLOSED = 'clicksign-document-closed'

// Margem curta: o `signed_file_url` já vem pronto no payload do webhook.
export const DOCUMENT_CLOSED_DELAY_MS = 5_000

export interface ClicksignDocumentClosedJob {
  appId: string
  payload: WebhookPayload
}

export const clicksignDocumentClosedQueue =
  new Queue<ClicksignDocumentClosedJob>(CLICKSIGN_DOCUMENT_CLOSED, {
    connection: redisConnection,
  })

export async function enqueueDocumentClosed(
  job: ClicksignDocumentClosedJob,
): Promise<void> {
  await clicksignDocumentClosedQueue.add('document-closed', job, {
    delay: DOCUMENT_CLOSED_DELAY_MS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    // Mantém jobs mortos 7 dias para inspeção.
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  })
  apiLogger.info(
    {
      app: 'clicksign',
      queue: CLICKSIGN_DOCUMENT_CLOSED,
      appId: job.appId,
      documentKey: job.payload.document.key,
    },
    'Clicksign document_closed job enqueued',
  )
}
