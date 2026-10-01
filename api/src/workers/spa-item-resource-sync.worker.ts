import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  SPA_ITEM_CLEANUP_JOB,
  SPA_ITEM_RESOURCE_SYNC,
  SPA_ITEM_STATUS_JOB,
  SpaItemResourceSyncJob,
} from '@/queue/spa-item-resource-sync.queue'
import { workerLogger } from '@/shared/infra/logger'
import {
  processSpaItemCleanup,
  processSpaItemStatusSync,
} from './spa-item-resource-sync.processor'
import { jobFailureLogFields } from '@/shared/infra/log-error'

// concurrency baixa: Bitrix, provider e gateway têm rate limit; melhor a fila crescer.
// Nome de job desconhecido não propaga: job de deploy futuro em worker antigo não deve retentar.
export const spaItemResourceSyncWorker = new Worker(
  SPA_ITEM_RESOURCE_SYNC,
  async job => {
    const data = job.data as SpaItemResourceSyncJob

    if (job.name === SPA_ITEM_CLEANUP_JOB) {
      await processSpaItemCleanup(data)
      return
    }

    if (job.name === SPA_ITEM_STATUS_JOB) {
      await processSpaItemStatusSync(data)
      return
    }

    workerLogger.error(
      {
        app: 'thinkzap',
        queue: SPA_ITEM_RESOURCE_SYNC,
        jobId: job.id,
        jobName: job.name,
        itemId: data?.itemId,
      },
      'Job de nome desconhecido na fila de recurso do item — descartado',
    )
  },
  {
    ...bullBaseOptions,
    concurrency: 2,
  },
)

spaItemResourceSyncWorker.on('failed', (job, err) => {
  const data = job?.data as SpaItemResourceSyncJob | undefined

  // Log de transporte (tentativas); o detalhe já foi logado no caso de uso.
  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: job?.id,
      jobName: job?.name,
      itemId: data?.itemId,
      traceKey: data?.traceKey,
      attemptsMade: job?.attemptsMade,
      attemptsAllowed: job?.opts.attempts,
      ...jobFailureLogFields(err),
    },
    'Job de recurso do item da SPA falhou',
  )
})

spaItemResourceSyncWorker.on('ready', () => {
  workerLogger.info(
    { event: 'worker.ready', app: 'thinkzap', queue: SPA_ITEM_RESOURCE_SYNC },
    'SPA item resource sync worker is ready',
  )
})
