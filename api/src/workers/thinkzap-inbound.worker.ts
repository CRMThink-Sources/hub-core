import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import {
  THINKZAP_INBOUND,
  ThinkzapInboundJob,
} from '@/queue/thinkzap-inbound.queue'
import { processZApiReceivedMessage } from './z-api-received-message.processor'
import { processBitrixReceivedMessage } from './bitrix-received-message.processor'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { logger } from '@/shared/infra/logger'

async function processJob(data: ThinkzapInboundJob) {
  if (data.source === 'z-api') {
    logger.debug(
      { source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processZApiReceivedMessage(data.body as ReceivedMessageEvent)
  } else if (data.source === 'bitrix') {
    logger.debug(
      { source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processBitrixReceivedMessage(
      data.body as unknown as IBX24MessageEvent,
    )
  }
}

export const thinkzapInboundWorker = new Worker(
  THINKZAP_INBOUND,
  async job => {
    await processJob(job.data as ThinkzapInboundJob)
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
)

thinkzapInboundWorker.on('failed', (job, err) => {
  logger.error(
    {
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: (job?.data as ThinkzapInboundJob | undefined)?.source,
      type: (job?.data as ThinkzapInboundJob | undefined)?.type,
      attemptsMade: job?.attemptsMade,
      error: err,
    },
    'Worker job failed',
  )
})

thinkzapInboundWorker.on('completed', job => {
  logger.info(
    {
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: (job?.data as ThinkzapInboundJob | undefined)?.source,
      type: (job?.data as ThinkzapInboundJob | undefined)?.type,
      attemptsMade: job?.attemptsMade,
    },
    'Worker job completed',
  )
})

thinkzapInboundWorker.on('active', job => {
  logger.info(
    {
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: (job?.data as ThinkzapInboundJob | undefined)?.source,
      attemptsMade: job?.attemptsMade,
    },
    'Worker job active',
  )
})

thinkzapInboundWorker.on('ready', () => {
  logger.info({ queue: THINKZAP_INBOUND }, 'Thinkzap inbound worker is ready')
})
