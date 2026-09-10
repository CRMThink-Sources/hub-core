import { DelayedError, Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
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
import { processBitrixBotEvent } from './bitrix-bot-event.processor'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { workerLogger } from '@/shared/infra/logger'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { makeAppendJobLog } from './append-job-log'
import { installBitrixLimits } from '@/shared/infra/bitrix-limits/install-bitrix-limits'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'

// O worker compartilha o balde do portal com a API: o limite do Bitrix conta por
// instalação, não por processo.
installBitrixLimits()

// Só inbound: a fila `thinkzap-widget-outbound` saiu para processo próprio (serviço
// `worker-widget-outbound` no compose) para que um envio lento não segure slot de
// mensagem recebida, nem um reinício derrube os dois fluxos.
async function processJob(
  data: ThinkzapInboundJob,
  appendJobLog: AppendJobLog,
) {
  /**
   * Primeira linha da aba Logs, igual para todo `source`: enquadra o resto e, sozinha,
   * já distingue "o job nem chegou ao processor certo" de "chegou e o envio falhou".
   *
   * `type` cai em marcador quando falta. A união do job declara `type: string`, mas o
   * controller da HubMessage o preenche com o `messageEventType` do envelope, que o
   * provider não manda sempre — e `type=undefined` cru lê como bug nosso quando o que
   * houve foi campo ausente do provider.
   *
   * O `traceKey` sai aqui e não nas linhas dos use cases: ele vive no job, não no corpo
   * da mensagem, e é a única ponte entre esta aba e a query no Loki do enfileiramento.
   */
  await appendJobLog(
    `Job recebido | source=${data.source} | type=${data.type || '—'} | ` +
      `traceKey=${data.traceKey || '—'}`,
  )

  if (data.source === 'z-api') {
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
    // Desfecho de mensagem nossa, não recebida: corpo com outra forma (sem `sender`,
    // com `contents[].state`), por isso `source` próprio.
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
      // Método pausado por `OPERATION_TIME_LIMIT` só volta quando a cesta de minuto do
      // Bitrix vence — mais que as 3 tentativas com backoff de 1s da fila. Reagendar
      // para o instante da liberação não gasta tentativa.
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
        // Sinal que o BullMQ exige para nao tratar o job como concluido.
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
      error: err,
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
