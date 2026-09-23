import { Job, Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  THINKZAP_LINE_CONNECTED_SYNC,
  type ThinkzapLineConnectedSyncJob,
} from '@/queue/thinkzap-line-connected-sync.queue'
import { makeLineConnectedSyncDeps } from '@/modules/thinkzap/main/make-sync-line-connected-field'
import { processLineConnectedSyncJob } from './thinkzap-line-connected-sync.processor'
import { workerLogger } from '@/shared/infra/logger'
import { makeAppendJobLog } from './append-job-log'

/**
 * Worker da gravação de `UF_CRM_93_CONNECTED` — sem entrypoint próprio, importado
 * por efeito colateral em `thinkzap-inbound.worker.ts`, pelo mesmo motivo de
 * `thinkzap-connection-events.worker.ts`: um job por queda/subida de linha, não por
 * mensagem.
 */
let deps: ReturnType<typeof makeLineConnectedSyncDeps> | undefined

async function processJob(
  job: Job<ThinkzapLineConnectedSyncJob>,
): Promise<void> {
  // Montado no primeiro job, não no import: o worker é importado por efeito
  // colateral, e os clients leem `env` na construção.
  deps ??= makeLineConnectedSyncDeps()

  await processLineConnectedSyncJob(job.data, deps, {
    appendJobLog: makeAppendJobLog(job),
  })
}

export const thinkzapLineConnectedSyncWorker =
  new Worker<ThinkzapLineConnectedSyncJob>(
    THINKZAP_LINE_CONNECTED_SYNC,
    processJob,
    {
      ...bullBaseOptions,
      concurrency: 5,
    },
  )

function jobBaseFields(job: Job<ThinkzapLineConnectedSyncJob> | undefined) {
  return {
    app: 'thinkzap',
    queue: THINKZAP_LINE_CONNECTED_SYNC,
    jobId: job?.id,
    provider: job?.data?.provider,
    connectionEvent: job?.data?.event,
    remoteId: job?.data?.remoteId,
    attemptsMade: job?.attemptsMade,
  }
}

thinkzapLineConnectedSyncWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0

  workerLogger.error(
    {
      event: 'worker.job.failed',
      ...jobBaseFields(job),
      willRetry: attemptsMade < maxAttempts,
      maxAttempts,
      error: err,
    },
    'Line connected sync job failed',
  )
})

thinkzapLineConnectedSyncWorker.on('completed', job => {
  workerLogger.info(
    { event: 'worker.job.completed', ...jobBaseFields(job) },
    'Line connected sync job completed',
  )
})

thinkzapLineConnectedSyncWorker.on('error', err => {
  workerLogger.error(
    {
      event: 'worker.error',
      app: 'thinkzap',
      queue: THINKZAP_LINE_CONNECTED_SYNC,
      err,
    },
    'Line connected sync worker error',
  )
})
