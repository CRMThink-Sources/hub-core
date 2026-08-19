import { DelayedError, Job, Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  THINKZAP_WIDGET_OUTBOUND,
  ThinkzapWidgetOutboundJob,
} from '@/queue/thinkzap-widget-outbound.queue'
import { processWidgetOpenChannelJob } from './thinkzap-widget-outbound.processor'
import { processWidgetSendJob } from './thinkzap-widget-send.processor'
import { workerLogger } from '@/shared/infra/logger'
import { makeAppendJobLog } from './append-job-log'

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
  const appendJobLog = makeAppendJobLog(job)

  if (data.kind === 'open-channel') {
    await processWidgetOpenChannelJob(data, { appendJobLog })
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

  const outcome = await processWidgetSendJob(data, {
    isLastAttempt,
    appendJobLog,
  })

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
    ...bullBaseOptions,
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

/**
 * Base de correlação, igual em todos os desfechos do job.
 *
 * `jobId` é determinístico e derivado do outbox, então filtrar por ele no Loki devolve
 * o ciclo de vida inteiro de **uma** mensagem: quando entrou, quanto esperou, quanto
 * demorou, como terminou. É o que responde "o que houve com esta mensagem".
 */
function jobBaseFields(job: Job<ThinkzapWidgetOutboundJob> | undefined) {
  return {
    app: 'thinkzap',
    queue: THINKZAP_WIDGET_OUTBOUND,
    jobId: job?.id,
    ...jobLogFields(job?.data),
    attemptsMade: job?.attemptsMade,
  }
}

/**
 * Os dois tempos que separam as duas causas possíveis de lentidão, e que sem medição
 * viram a mesma queixa ("demorou").
 *
 * `waitMs` — da criação do job até um worker pegá-lo. Alto = fila represada, worker
 * parado ou sem vazão. É problema **nosso**.
 * `runMs` — do início ao fim do processamento. Alto = provider ou Bitrix lentos. É
 * problema **de terceiro**.
 */
function jobTimings(job: Job<ThinkzapWidgetOutboundJob>) {
  const startedAt = job.processedOn
  const finishedAt = job.finishedOn

  return {
    waitMs: startedAt ? startedAt - job.timestamp : undefined,
    runMs: startedAt && finishedAt ? finishedAt - startedAt : undefined,
  }
}

/**
 * `active` é o que distingue "o job nunca chegou ao worker" de "chegou e travou".
 *
 * Sem ele, um job que morre no meio não deixa rastro nenhum: não há `completed`, o
 * `failed` só aparece depois do timeout de stall, e a mensagem some do log entre o
 * enfileiramento e o desfecho. Era o buraco de diagnóstico desta fila — o worker de
 * inbound já escutava este evento.
 */
thinkzapWidgetOutboundWorker.on('active', job => {
  workerLogger.info(
    { ...jobBaseFields(job), waitMs: jobTimings(job).waitMs },
    'Widget outbound job started',
  )
})

thinkzapWidgetOutboundWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0

  workerLogger.error(
    {
      ...jobBaseFields(job),
      ...(job ? jobTimings(job) : {}),
      /**
       * Distingue "vai tentar de novo" de "acabou aqui". Sem isto, três linhas de
       * `failed` do mesmo job parecem três mensagens perdidas, quando são duas
       * retentativas e uma desistência.
       */
      willRetry: attemptsMade < maxAttempts,
      maxAttempts,
      error: err,
    },
    'Widget outbound job failed',
  )
})

thinkzapWidgetOutboundWorker.on('completed', job => {
  workerLogger.info(
    { ...jobBaseFields(job), ...jobTimings(job) },
    'Widget outbound job completed',
  )
})

/**
 * Job travado: o worker parou de renovar o lock e o BullMQ vai devolvê-lo à fila.
 *
 * Ninguém escutava, e este é exatamente o evento que explica uma mensagem que "sumiu":
 * processo morto no meio do envio, event loop bloqueado, ou o job passando do
 * `lockDuration`. Sem esta linha, o reprocessamento aparece como um segundo `active`
 * sem causa visível.
 *
 * No caminho de envio, um job stalled é o que produz `status = UNKNOWN` no outbox —
 * entrega indeterminada, que não é reenviada de propósito.
 */
thinkzapWidgetOutboundWorker.on('stalled', jobId => {
  workerLogger.error(
    { app: 'thinkzap', queue: THINKZAP_WIDGET_OUTBOUND, jobId, stalled: true },
    'Widget outbound job stalled — será reprocessado; envio pode ficar indeterminado',
  )
})

/**
 * Erro do próprio worker, não de um job: conexão com o Redis, principalmente.
 *
 * Sem isto, Redis fora aparece só como ausência de processamento — a fila para e nada
 * no log diz por quê.
 */
thinkzapWidgetOutboundWorker.on('error', err => {
  workerLogger.error(
    { app: 'thinkzap', queue: THINKZAP_WIDGET_OUTBOUND, err },
    'Widget outbound worker error',
  )
})

thinkzapWidgetOutboundWorker.on('ready', () => {
  workerLogger.info(
    { app: 'thinkzap', queue: THINKZAP_WIDGET_OUTBOUND },
    'Thinkzap widget outbound worker is ready',
  )
})
