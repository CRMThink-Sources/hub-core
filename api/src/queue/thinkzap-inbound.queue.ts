import { Queue } from 'bullmq'
import { redisConnection } from './redis-connection'

export const THINKZAP_INBOUND = 'thinkzap-inbound'

export type ThinkzapInboundJob =
  | { source: 'z-api'; type: string; body: Record<string, unknown> }
  | { source: 'bitrix'; type: string; body: Record<string, unknown> }

export const thinkzapInboundQueue = new Queue<ThinkzapInboundJob>(
  THINKZAP_INBOUND,
  {
    connection: redisConnection,
  },
)

export async function enqueueThinkzapInboundJob(job: ThinkzapInboundJob) {
  return thinkzapInboundQueue.add('process-inbound', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  })
}
