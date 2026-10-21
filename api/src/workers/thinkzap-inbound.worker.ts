import { DelayedError, Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  THINKZAP_INBOUND,
  ThinkzapInboundJob,
} from '@/queue/thinkzap-inbound.queue'
import { processZApiReceivedMessage } from './z-api-received-message.processor'
import { processZApiSentByMeMessage } from './z-api-sent-by-me.processor'
import { ZAPI_SENT_BY_ME_JOB_TYPE } from '@/shared/infra/handlers/z-api/received-message.handler'
import { processHubMessageReceivedMessage } from './hubmessage-received-message.processor'
import type {
  HubMessageStatusEnvelope,
  HubMessageWebhookMessage,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { processHubMessageDeliveryStatus } from './hubmessage-status.processor'
import { processBitrixReceivedMessage } from './bitrix-received-message.processor'
import { processBitrixBotEvent } from './bitrix-bot-event.processor'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { workerLogger } from '@/shared/infra/logger'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { makeAppendJobLog } from './append-job-log'
import { installBitrixLimits } from '@/shared/infra/bitrix-limits/install-bitrix-limits'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
// Efeito colateral: registram esses Workers neste mesmo processo.
import './thinkzap-connection-events.worker'
import './thinkzap-line-connected-sync.worker'
import { jobFailureLogFields } from '@/shared/infra/log-error'

// O limite do Bitrix conta por instalação, não por processo: compartilha o balde com a API.
installBitrixLimits()

// Widget outbound roda em processo próprio para envio lento não segurar slot do inbound.
async function processJob(
  data: ThinkzapInboundJob,
  appendJobLog: AppendJobLog,
) {
  // `type` pode faltar (HubMessage nem sempre manda); `traceKey` liga esta aba ao Loki.
  await appendJobLog(
    `Job recebido | source=${data.source} | type=${data.type || '—'} | ` +
      `traceKey=${data.traceKey || '—'}`,
  )

  if (data.source === 'z-api' && data.type === ZAPI_SENT_BY_ME_JOB_TYPE) {
    // Mesmo corpo do `ReceivedCallback`, mas enviado pelo aparelho da linha: espelha.
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processZApiSentByMeMessage(data.body as ReceivedMessageEvent, {
      appendJobLog,
    })
  } else if (data.source === 'z-api') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processZApiReceivedMessage(data.body as ReceivedMessageEvent, {
      appendJobLog,
    })
  } else if (data.source === 'hubmessage') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processHubMessageReceivedMessage(
      data.body as unknown as HubMessageWebhookMessage,
      { appendJobLog },
    )
  } else if (data.source === 'hubmessage-status') {
    // Status de mensagem nossa: corpo sem `sender`, com `contents[].state`.
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processHubMessageDeliveryStatus(
      { message: data.body } as unknown as HubMessageStatusEnvelope,
      { appendJobLog },
    )
  } else if (data.source === 'bitrix-bot') {
    // Antes do branch `'bitrix'`: o processor lê `bot`/`chat`/`user`, não `data.MESSAGES`.
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processBitrixBotEvent(data.body, { appendJobLog })
  } else if (data.source === 'bitrix') {
    workerLogger.debug(
      { app: 'thinkzap', source: data.source, type: data.type },
      'Processing inbound job',
    )
    await processBitrixReceivedMessage(
      data.body as unknown as IBX24MessageEvent,
      {
        appendJobLog,
      },
    )
  }
}

export const thinkzapInboundWorker = new Worker(
  THINKZAP_INBOUND,
  async (job, token) => {
    try {
      await processJob(job.data as ThinkzapInboundJob, makeAppendJobLog(job))
    } catch (err) {
      // Pausa por `OPERATION_TIME_LIMIT` dura mais que o backoff: reagenda sem gastar tentativa.
      if (err instanceof BitrixMethodPausedError) {
        workerLogger.warn(
          {
            app: 'thinkzap',
            queue: THINKZAP_INBOUND,
            jobId: job.id,
            method: err.method,
            domain: err.domain,
            retryAt: new Date(err.untilMs).toISOString(),
            bitrixMethodPaused: true,
          },
          'Metodo do Bitrix pausado — reagendando o job sem gastar tentativa',
        )

        await job.moveToDelayed(err.untilMs, token)
        // Exigido pelo BullMQ para não tratar o job como concluído.
        throw new DelayedError()
      }

      throw err
    }
  },
  {
    ...bullBaseOptions,
    concurrency: 10,
  },
)

thinkzapInboundWorker.on('failed', (job, err) => {
  const data = job?.data as ThinkzapInboundJob | undefined
  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'thinkzap',
      queue: THINKZAP_INBOUND,
      jobId: job?.id,
      source: data?.source,
      type: data?.type,
      attemptsMade: job?.attemptsMade,
      ...jobFailureLogFields(err),
    },
    'Worker job failed',
  )
})

thinkzapInboundWorker.on('completed', job => {
  const data = job?.data as ThinkzapInboundJob | undefined
  workerLogger.info(
    {
      event: 'worker.job.completed',
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
      event: 'worker.job.active',
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
    { event: 'worker.ready', app: 'thinkzap', queue: THINKZAP_INBOUND },
    'Thinkzap inbound worker is ready',
  )
})
