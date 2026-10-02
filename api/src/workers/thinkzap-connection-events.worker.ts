import { Job, Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  THINKZAP_CONNECTION_EVENTS,
  type ThinkzapConnectionEventJob,
} from '@/queue/thinkzap-connection-events.queue'
import { processConnectionEventJob } from './thinkzap-connection-notify.processor'
import { workerLogger } from '@/shared/infra/logger'
import { makeAppendJobLog } from './append-job-log'
import { jobFailureLogFields } from '@/shared/infra/log-error'

// Sem entrypoint próprio de propósito: job raro e best-effort, importado em thinkzap-inbound.worker.ts.
async function processJob(job: Job<ThinkzapConnectionEventJob>): Promise<void> {
  await processConnectionEventJob(job.data, {
    appendJobLog: makeAppendJobLog(job),
  })
}

export const thinkzapConnectionEventsWorker =
  new Worker<ThinkzapConnectionEventJob>(
    THINKZAP_CONNECTION_EVENTS,
    processJob,
    {
      ...bullBaseOptions,
      concurrency: 5,
    },
  )

function jobBaseFields(job: Job<ThinkzapConnectionEventJob> | undefined) {
  return {
    app: 'thinkzap',
    queue: THINKZAP_CONNECTION_EVENTS,
    jobId: job?.id,
    type: job?.data?.type,
    instanceId: job?.data?.instanceId,
    attemptsMade: job?.attemptsMade,
  }
}

thinkzapConnectionEventsWorker.on('active', job => {
  workerLogger.info(
    { event: 'worker.job.active', ...jobBaseFields(job) },
    'Connection event job started',
  )
})

thinkzapConnectionEventsWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0

  workerLogger.error(
    {
      event: 'worker.job.failed',
      ...jobBaseFields(job),
      willRetry: attemptsMade < maxAttempts,
      maxAttempts,
      ...jobFailureLogFields(err),
    },
    'Connection event job failed',
  )
})

thinkzapConnectionEventsWorker.on('completed', job => {
  workerLogger.info(
    { event: 'worker.job.completed', ...jobBaseFields(job) },
    'Connection event job completed',
  )
})

thinkzapConnectionEventsWorker.on('stalled', jobId => {
  workerLogger.error(
    {
      event: 'worker.job.stalled',
      app: 'thinkzap',
      queue: THINKZAP_CONNECTION_EVENTS,
      jobId,
    },
    'Connection event job stalled — será reprocessado',
  )
})

thinkzapConnectionEventsWorker.on('error', err => {
  workerLogger.error(
    {
      event: 'worker.error',
      app: 'thinkzap',
      queue: THINKZAP_CONNECTION_EVENTS,
      err,
    },
    'Connection events worker error',
  )
})

thinkzapConnectionEventsWorker.on('ready', () => {
  workerLogger.info(
    {
      event: 'worker.ready',
      app: 'thinkzap',
      queue: THINKZAP_CONNECTION_EVENTS,
    },
    'Thinkzap connection events worker is ready',
  )
})
