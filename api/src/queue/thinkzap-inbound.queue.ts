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
  // Status do que nós enviamos (`MESSAGE_DELIVERY`). `source` próprio e não
  // `'hubmessage'` com outro `type`: o worker casta aquele branch para
  // `HubMessageWebhookMessage`, e este corpo tem outra forma (sem `sender`, com
  // `contents[].state`) — o cast passaria no TypeScript e estouraria em runtime.
  | {
      source: 'hubmessage-status'
      type: string
      body: Record<string, unknown>
      traceKey: string
    }
  // Eventos `ONIMBOTV2*`. `source` próprio pelo mesmo motivo do `hubmessage-status`: o
  // branch `'bitrix'` casta para `IBX24MessageEvent` (`data.LINE`, `data.MESSAGES`) e o
  // evento do bot vem em `bot`/`chat`/`user`, camelCase.
  | {
      source: 'bitrix-bot'
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
      event: 'queue.job.enqueued',
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
