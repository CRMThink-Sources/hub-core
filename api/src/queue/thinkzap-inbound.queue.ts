import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const THINKZAP_INBOUND = 'thinkzap-inbound'

export type ThinkzapInboundJob =
  | {
      source: 'z-api'
      type: string
      body: Record<string, unknown>
      traceKey: string
    }
  | {
      source: 'bitrix'
      type: string
      body: Record<string, unknown>
      traceKey: string
    }
  | {
      source: 'hubmessage'
      type: string
      body: Record<string, unknown>
      traceKey: string
    }
  /**
   * Callback de status do que **nós** enviamos (`MESSAGE_DELIVERY`), não mensagem
   * recebida.
   *
   * `source` próprio, e não `source: 'hubmessage'` com outro `type`: o worker casta o
   * `body` do branch `'hubmessage'` para `HubMessageWebhookMessage`, e esse corpo tem
   * outra forma (sem `sender`, com `contents[].state`). Enfiado atrás do mesmo
   * `source`, o cast passa pelo TypeScript e estoura em runtime.
   */
  | {
      source: 'hubmessage-status'
      type: string
      body: Record<string, unknown>
      traceKey: string
    }

export const thinkzapInboundQueue = new Queue<ThinkzapInboundJob>(
  THINKZAP_INBOUND,
  bullBaseOptions,
)

export async function enqueueThinkzapInboundJob(
  job: ThinkzapInboundJob,
  opts?: { jobId?: string },
) {
  const createdJob = await thinkzapInboundQueue.add('process-inbound', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    // Chave determinística: reentrega do mesmo evento é colapsada pelo BullMQ.
    ...(opts?.jobId ? { jobId: opts.jobId } : {}),
  })

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_INBOUND,
      jobId: createdJob.id,
      source: job.source,
      type: job.type,
      traceKey: job.traceKey,
    },
    'Inbound job enqueued',
  )

  return createdJob
}
