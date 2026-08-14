import { DelayedError, Job, Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import {
  THINKZAP_WIDGET_OUTBOUND,
  ThinkzapWidgetOutboundJob,
} from '@/queue/thinkzap-widget-outbound.queue'
import { processWidgetOpenChannelJob } from './thinkzap-widget-outbound.processor'
import { processWidgetSendJob } from './thinkzap-widget-send.processor'
import { workerLogger } from '@/shared/infra/logger'

/**
 * Atraso do reagendamento por contenção de destino. Curto porque a espera típica é a
 * duração de um envio; longo o bastante para não virar espera ativa contra o Redis.
 */
const DESTINATION_BUSY_RETRY_MS = 2_000

/**
 * Worker do outbound do widget — **entrypoint próprio**.
 *
 * Serviço `worker-widget-outbound` no compose, container
 * `hubthink-worker-widget-outbound`. O nome precisa começar com `hubthink-worker`: é o
 * que o Promtail casa para coletar os logs, e fora dessa convenção o log do processo
 * que entrega mensagem some da coleta em silêncio.
 *
 * Rodou dentro do processo de inbound enquanto a fila só carregava a abertura de
 * conversa no canal aberto — efeito colateral idempotente, cuja falha ninguém sente na
 * hora. Saiu quando passou a carregar `kind: 'send'`, a entrega ao contato: a partir
 * daí um envio lento segura slot de mensagem recebida, reiniciar um fluxo derruba o
 * outro, e os logs dos dois se misturam no mesmo stream.
 *
 * `concurrency` menor que a do inbound, e **não** foi aumentada com a separação: o
 * limite nunca foi contenção de processo, e sim o Bitrix do cliente, que tem limite de
 * requisições por portal.
 */
async function processJob(
  job: Job<ThinkzapWidgetOutboundJob>,
  token?: string,
): Promise<void> {
  const data = job.data

  if (data.kind === 'open-channel') {
    await processWidgetOpenChannelJob(data)
    return
  }

  /**
   * `attemptsMade` conta as tentativas **anteriores**, então a atual é a última quando
   * somada a ela alcança o limite. O despacho precisa saber disso para decidir entre
   * devolver a intenção para `PENDING` (vai retentar) e marcá-la como `FAILED` com
   * aviso ao operador (não vai).
   */
  const maxAttempts = job.opts.attempts ?? 1
  const isLastAttempt = job.attemptsMade + 1 >= maxAttempts

  const outcome = await processWidgetSendJob(data, { isLastAttempt })

  if (outcome === 'reschedule') {
    /**
     * `moveToDelayed` + `DelayedError` é o caminho do BullMQ para adiar **sem contar
     * tentativa**. Lançar um erro comum aqui gastaria uma das três, e uma conversa
     * movimentada esgotaria as tentativas por contenção — marcando como falha um envio
     * que nunca chegou a ser tentado.
     */
    await job.moveToDelayed(Date.now() + DESTINATION_BUSY_RETRY_MS, token)
    throw new DelayedError()
  }
}

export const thinkzapWidgetOutboundWorker =
  new Worker<ThinkzapWidgetOutboundJob>(THINKZAP_WIDGET_OUTBOUND, processJob, {
    connection: redisConnection,
    concurrency: 5,
  })

/** Campos de log específicos de cada `kind`, sem vazar `any` no logger. */
function jobLogFields(
  data: ThinkzapWidgetOutboundJob | undefined,
): Record<string, unknown> {
  if (!data) return {}

  return data.kind === 'open-channel'
    ? {
        kind: data.kind,
        subscriptionItemId: data.subscriptionItemId,
        providerMessageId: data.providerMessageId,
      }
    : { kind: data.kind, outboxId: data.outboxId }
}

thinkzapWidgetOutboundWorker.on('failed', (job, err) => {
  workerLogger.error(
    {
      app: 'thinkzap',
      queue: THINKZAP_WIDGET_OUTBOUND,
      jobId: job?.id,
      ...jobLogFields(job?.data),
      attemptsMade: job?.attemptsMade,
      error: err,
    },
    'Widget outbound job failed',
  )
})

thinkzapWidgetOutboundWorker.on('completed', job => {
  workerLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_WIDGET_OUTBOUND,
      jobId: job?.id,
      ...jobLogFields(job?.data),
      attemptsMade: job?.attemptsMade,
    },
    'Widget outbound job completed',
  )
})

thinkzapWidgetOutboundWorker.on('ready', () => {
  workerLogger.info(
    { app: 'thinkzap', queue: THINKZAP_WIDGET_OUTBOUND },
    'Thinkzap widget outbound worker is ready',
  )
})
