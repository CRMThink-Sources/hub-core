import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import {
  THINKZAP_INBOUND,
  ThinkzapInboundJob,
} from '@/queue/thinkzap-inbound.queue'
import { processZApiReceivedMessage } from './z-api-received-message.processor'
import { processHubMessageReceivedMessage } from './hubmessage-received-message.processor'
import type {
  HubMessageStatusEnvelope,
  HubMessageWebhookMessage,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { processHubMessageDeliveryStatus } from './hubmessage-status.processor'
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
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { makeAppendJobLog } from './append-job-log'

/**
 * Este entrypoint é **só o inbound**.
 *
 * O `Worker` da fila `thinkzap-widget-outbound` chegou a ser registrado aqui, enquanto
 * aquela fila só carregava a abertura de conversa no canal aberto. Saiu para processo
 * próprio quando passou a carregar a entrega da mensagem ao contato: um envio lento
 * segurando slot de mensagem recebida, e um reinício derrubando os dois fluxos, é o
 * que a separação evita. Ver o serviço `worker-widget-outbound` no compose.
 */
async function processJob(
  data: ThinkzapInboundJob,
  appendJobLog: AppendJobLog,
) {
  /**
   * Primeira linha da aba Logs, igual para todo `source`: enquadra o resto e, sozinha,
   * já distingue "o job nem chegou ao processor certo" de "chegou e o envio falhou".
   */
  await appendJobLog(`Job recebido | source=${data.source} | type=${data.type}`)

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
  } else if (data.source === 'hubmessage-status') {
    /**
     * Desfecho de mensagem **nossa**, não mensagem recebida: o corpo tem outra forma
     * (sem `sender`, com `contents[].state`) e por isso tem `source` próprio.
     */
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processHubMessageDeliveryStatus(
      { message: data.body } as unknown as HubMessageStatusEnvelope,
      { appendJobLog },
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
        { appendJobLog },
      )
    }
  }
}

export const thinkzapInboundWorker = new Worker(
  THINKZAP_INBOUND,
  async job => {
    await processJob(job.data as ThinkzapInboundJob, makeAppendJobLog(job))
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
