import { Queue } from 'bullmq'
import { redisConnection } from './redis-connection'
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

export const thinkzapInboundQueue = new Queue<ThinkzapInboundJob>(
  THINKZAP_INBOUND,
  {
    connection: redisConnection,
  },
)

export async function enqueueThinkzapInboundJob(job: ThinkzapInboundJob) {
  const createdJob = await thinkzapInboundQueue.add('process-inbound', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
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
