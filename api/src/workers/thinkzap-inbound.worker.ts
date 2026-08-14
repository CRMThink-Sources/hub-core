import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import {
  THINKZAP_INBOUND,
  ThinkzapInboundJob,
} from '@/queue/thinkzap-inbound.queue'
import { processZApiReceivedMessage } from './z-api-received-message.processor'
import { processHubMessageReceivedMessage } from './hubmessage-received-message.processor'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { processBitrixReceivedMessage } from './bitrix-received-message.processor'
import { processBitrixMessageUpdate } from './bitrix-message-update.processor'
import { processBitrixMessageDelete } from './bitrix-message-delete.processor'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import {
  IBX24MessageEvent,
  IBX24MessageUpdateEvent,
  IBX24MessageDeleteEvent,
} from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { workerLogger } from '@/shared/infra/logger'

/**
 * Este entrypoint é o processo de worker do thinkzap, não só o do inbound: o import
 * abaixo registra o `Worker` da fila `thinkzap-widget-outbound` no mesmo processo.
 *
 * É o que evita um serviço novo no `docker-compose` — o `command` de produção aponta
 * para este arquivo. Ver `thinkzap-widget-outbound.worker.ts`.
 */
import './thinkzap-widget-outbound.worker'

async function processJob(data: ThinkzapInboundJob) {
  if (data.source === 'z-api') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processZApiReceivedMessage(data.body as ReceivedMessageEvent)
  } else if (data.source === 'hubmessage') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processHubMessageReceivedMessage(
      data.body as unknown as HubMessageWebhookMessage,
    )
  } else if (data.source === 'bitrix') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    if (data.type === 'ONIMCONNECTORMESSAGEUPDATE') {
      await processBitrixMessageUpdate(
        data.body as unknown as IBX24MessageUpdateEvent,
      )
    } else if (data.type === 'ONIMCONNECTORMESSAGEDELETE') {
      await processBitrixMessageDelete(
        data.body as unknown as IBX24MessageDeleteEvent,
      )
    } else {
      await processBitrixReceivedMessage(
        data.body as unknown as IBX24MessageEvent,
      )
    }
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
  const data = job?.data as ThinkzapInboundJob | undefined
  workerLogger.error(
    {
      app: 'thinkzap',
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: data?.source,
      type: data?.type,
      attemptsMade: job?.attemptsMade,
      error: err,
    },
    'Worker job failed',
  )
})

thinkzapInboundWorker.on('completed', job => {
  const data = job?.data as ThinkzapInboundJob | undefined
  workerLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: data?.source,
      type: data?.type,
      attemptsMade: job?.attemptsMade,
    },
    'Worker job completed',
  )
})

thinkzapInboundWorker.on('active', job => {
  const data = job?.data as ThinkzapInboundJob | undefined
  workerLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: data?.source,
      type: data?.type,
      attemptsMade: job?.attemptsMade,
    },
    'Worker job active',
  )
})

thinkzapInboundWorker.on('ready', () => {
  workerLogger.info(
    { app: 'thinkzap', queue: THINKZAP_INBOUND },
    'Thinkzap inbound worker is ready',
  )
})
