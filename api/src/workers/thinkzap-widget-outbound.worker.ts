import { startCadenceSequencerSweepJob } from '@/shared/infra/scheduler/cadence-sequencer-sweep.job'
import { Job, Worker } from 'bullmq'
import { applyWidgetSendOutcome } from './widget-send-outcome'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  THINKZAP_WIDGET_OUTBOUND,
  ThinkzapWidgetOutboundJob,
} from '@/queue/thinkzap-widget-outbound.queue'
import { processWidgetOpenChannelJob } from './thinkzap-widget-outbound.processor'
import { processWidgetSendJob } from './thinkzap-widget-send.processor'
import {
  THINKZAP_SEND_NOTICES,
  type SendNoticeJob,
} from '@/queue/thinkzap-send-notices.queue'
import { processSendNoticeJob } from './thinkzap-send-notices.processor'
import { workerLogger } from '@/shared/infra/logger'
import { makeAppendJobLog } from './append-job-log'
import { jobFailureLogFields } from '@/shared/infra/log-error'

// Entrypoint próprio: container deve começar com `hubthink-worker` senão o Promtail não coleta.
// concurrency limitada pelo rate limit do Bitrix por portal, não por processo.
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

  // `attemptsMade` conta só as anteriores; decide PENDING (retenta) vs FAILED (avisa operador).
  const maxAttempts = job.opts.attempts ?? 1
  const isLastAttempt = job.attemptsMade + 1 >= maxAttempts

  const outcome = await processWidgetSendJob(data, {
    isLastAttempt,
    appendJobLog,
  })

  await applyWidgetSendOutcome(job, outcome, token)
}

export const thinkzapWidgetOutboundWorker =
  new Worker<ThinkzapWidgetOutboundJob>(THINKZAP_WIDGET_OUTBOUND, processJob, {
    ...bullBaseOptions,
    concurrency: 5,
  })

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

// `jobId` deriva do outbox: filtrar por ele no Loki dá o ciclo de vida de uma mensagem.
function jobBaseFields(job: Job<ThinkzapWidgetOutboundJob> | undefined) {
  return {
    app: 'thinkzap',
    queue: THINKZAP_WIDGET_OUTBOUND,
    jobId: job?.id,
    ...jobLogFields(job?.data),
    attemptsMade: job?.attemptsMade,
  }
}

// waitMs alto = fila/worker nosso; runMs alto = provider ou Bitrix lentos.
function jobTimings(job: Job<ThinkzapWidgetOutboundJob>) {
  const startedAt = job.processedOn
  const finishedAt = job.finishedOn

  return {
    waitMs: startedAt ? startedAt - job.timestamp : undefined,
    runMs: startedAt && finishedAt ? finishedAt - startedAt : undefined,
  }
}

// Distingue "nunca chegou ao worker" de "chegou e travou".
thinkzapWidgetOutboundWorker.on('active', job => {
  workerLogger.info(
    {
      event: 'worker.job.active',
      ...jobBaseFields(job),
      waitMs: jobTimings(job).waitMs,
    },
    'Widget outbound job started',
  )
})

thinkzapWidgetOutboundWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0

  workerLogger.error(
    {
      event: 'worker.job.failed',
      ...jobBaseFields(job),
      ...(job ? jobTimings(job) : {}),
      willRetry: attemptsMade < maxAttempts,
      maxAttempts,
      ...jobFailureLogFields(err),
    },
    'Widget outbound job failed',
  )
})

thinkzapWidgetOutboundWorker.on('completed', job => {
  workerLogger.info(
    {
      event: 'worker.job.completed',
      ...jobBaseFields(job),
      ...jobTimings(job),
    },
    'Widget outbound job completed',
  )
})

// No envio, stalled vira `status = UNKNOWN` no outbox: entrega indeterminada, não reenviada de propósito.
thinkzapWidgetOutboundWorker.on('stalled', jobId => {
  workerLogger.error(
    {
      event: 'worker.job.stalled',
      app: 'thinkzap',
      queue: THINKZAP_WIDGET_OUTBOUND,
      jobId,
      stalled: true,
    },
    'Widget outbound job stalled — será reprocessado; envio pode ficar indeterminado',
  )
})

// Erro do worker (ex.: Redis fora), não de um job.
thinkzapWidgetOutboundWorker.on('error', err => {
  workerLogger.error(
    {
      event: 'worker.error',
      app: 'thinkzap',
      queue: THINKZAP_WIDGET_OUTBOUND,
      err,
    },
    'Widget outbound worker error',
  )
})

thinkzapWidgetOutboundWorker.on('ready', () => {
  workerLogger.info(
    { event: 'worker.ready', app: 'thinkzap', queue: THINKZAP_WIDGET_OUTBOUND },
    'Thinkzap widget outbound worker is ready',
  )
})

/**
 * Avisos de envio (comentário de status e notificação de falha) no mesmo processo: o
 * envio que os gera roda aqui, então eles existem sempre que existe quem envie, sem
 * container novo no compose.
 *
 * Concorrência 1 de propósito: o comentário é remontado do banco a cada execução, e
 * duas execuções do mesmo aviso em paralelo podiam terminar fora de ordem, a mais
 * antiga gravando por cima do status mais novo. Em pico os avisos ficam mais lentos,
 * o envio não.
 */
export const thinkzapSendNoticesWorker = new Worker<SendNoticeJob>(
  THINKZAP_SEND_NOTICES,
  job => processSendNoticeJob(job.data),
  { ...bullBaseOptions, concurrency: 1 },
)

function noticeJobFields(job: Job<SendNoticeJob> | undefined) {
  return {
    app: 'thinkzap',
    queue: THINKZAP_SEND_NOTICES,
    jobId: job?.id,
    kind: job?.data.kind,
    noticeId: job?.data.noticeId,
    attemptsMade: job?.attemptsMade,
  }
}

thinkzapSendNoticesWorker.on('active', job => {
  workerLogger.info(
    { event: 'worker.job.active', ...noticeJobFields(job) },
    'Send notice job started',
  )
})

thinkzapSendNoticesWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0

  workerLogger.error(
    {
      event: 'worker.job.failed',
      ...noticeJobFields(job),
      willRetry: attemptsMade < maxAttempts,
      maxAttempts,
      ...jobFailureLogFields(err),
    },
    'Send notice job failed',
  )
})

thinkzapSendNoticesWorker.on('completed', job => {
  workerLogger.info(
    { event: 'worker.job.completed', ...noticeJobFields(job) },
    'Send notice job completed',
  )
})

thinkzapSendNoticesWorker.on('stalled', jobId => {
  workerLogger.error(
    {
      event: 'worker.job.stalled',
      app: 'thinkzap',
      queue: THINKZAP_SEND_NOTICES,
      jobId,
      stalled: true,
    },
    'Send notice job stalled — será reprocessado',
  )
})

// Erro do worker (ex.: Redis fora), não de um job.
thinkzapSendNoticesWorker.on('error', err => {
  workerLogger.error(
    {
      event: 'worker.error',
      app: 'thinkzap',
      queue: THINKZAP_SEND_NOTICES,
      err,
    },
    'Send notice worker error',
  )
})

thinkzapSendNoticesWorker.on('ready', () => {
  workerLogger.info(
    { event: 'worker.ready', app: 'thinkzap', queue: THINKZAP_SEND_NOTICES },
    'Thinkzap send notices worker is ready',
  )
})

/**
 * A varredura do sequenciador FIFO da cadência roda **neste processo**: é ele que
 * consome a fila de envio, então a varredura existe sempre que existe quem envie.
 */
startCadenceSequencerSweepJob()
