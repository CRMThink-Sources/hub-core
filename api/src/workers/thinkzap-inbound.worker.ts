import { Job, Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import {
  THINKZAP_INBOUND,
  ThinkzapInboundJob,
} from '@/queue/thinkzap-inbound.queue'
import { processZApiReceivedMessage } from './z-api-received-message.processor'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'

async function processJob(data: ThinkzapInboundJob) {
  if (data.source === 'z-api') {
    // console.log('Processing Z-API inbound job', data)
    await processZApiReceivedMessage(data.body as ReceivedMessageEvent)
    // await handleZApiInboundJob(data.body)
  } else if (data.source === 'bitrix') {
    console.log('Processing Bitrix inbound job', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    // await handleBitrixInboundJob(data.body)
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
  console.error('Job failed', job?.id, err)
})

thinkzapInboundWorker.on('completed', (job, result) => {
  console.log('Job completed', job?.id, result)
})

thinkzapInboundWorker.on('active', job => {
  console.log('Job active', job?.id)
})
