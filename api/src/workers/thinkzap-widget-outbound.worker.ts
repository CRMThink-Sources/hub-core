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
 * A varredura do sequenciador FIFO da cadência roda **neste processo**: é ele que
 * consome a fila de envio, então a varredura existe sempre que existe quem envie.
 */
startCadenceSequencerSweepJob()
