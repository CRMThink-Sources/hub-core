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
 * Worker do outbound do widget.
 *
 * **Não é um processo próprio.** Este módulo é importado pelo entrypoint de worker do
 * thinkzap que já roda (`thinkzap-inbound.worker.ts`), porque um processo consome
 * quantas filas quiser e um serviço novo no `docker-compose` seria configuração de
 * infra para uma mudança de aplicação.
 *
 * O módulo nasce isolado justamente para que separá-lo depois seja só acrescentar um
 * `command` no compose apontando para cá — nada de código muda.
 *
 * `concurrency` menor que a do inbound: este worker fala com o Bitrix do cliente, que
 * tem limite de requisições por portal, e a fila é de efeito colateral — atrasar um
 * job alguns segundos não custa nada, tomar rate limit custa a conversa.
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
