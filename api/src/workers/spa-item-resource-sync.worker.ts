import { env } from '@/config/env'
import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  SPA_ITEM_CLEANUP_JOB,
  SPA_ITEM_RESOURCE_SYNC,
  SPA_ITEM_STATUS_JOB,
  SpaItemResourceSyncJob,
  SUBSCRIPTION_BILLING_SYNC_JOB,
  SubscriptionBillingSyncJob,
} from '@/queue/spa-item-resource-sync.queue'
import { workerLogger } from '@/shared/infra/logger'
import {
  processSpaItemCleanup,
  processSpaItemStatusSync,
  processSubscriptionBillingSync,
} from './spa-item-resource-sync.processor'
import { jobFailureLogFields } from '@/shared/infra/log-error'
import {
  CRMTHINK_TASK_SYNC,
  CRMTHINK_TASK_SYNC_JOB,
  type CrmthinkTaskSyncJob,
} from '@/queue/crmthink-task-sync.queue'
import { processCrmthinkTaskSync } from './crmthink-task-sync.processor'

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

    if (job.name === SUBSCRIPTION_BILLING_SYNC_JOB) {
      await processSubscriptionBillingSync(
        job.data as SubscriptionBillingSyncJob,
      )
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
  const data = job?.data as
    | (Partial<SpaItemResourceSyncJob> & Partial<SubscriptionBillingSyncJob>)
    | undefined

  // Log de transporte (tentativas); o detalhe já foi logado no caso de uso.
  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: job?.id,
      jobName: job?.name,
      itemId: data?.itemId,
      subscriptionId: data?.subscriptionId,
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
    {
      event: 'worker.ready',
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      spaProviderEffectsEnabled: env.payments.spa.providerEffectsEnabled,
    },
    'SPA item resource sync worker is ready',
  )
})

/**
 * Releitura das tarefas das novidades do ThinkZap (D5). Mora neste processo, e não num
 * worker novo, porque é o que já fala com o portal da CRMThink — um worker próprio
 * exigiria mais um serviço em `docker-compose.*`. Fila e `Worker` próprios: o volume e
 * o rate limit são outros, e um não deve esperar atrás do outro.
 *
 * Concurrency 1: são poucas novidades, e cada job é uma leitura no Bitrix.
 */
export const crmthinkTaskSyncWorker = new Worker(
  CRMTHINK_TASK_SYNC,
  async job => {
    if (job.name === CRMTHINK_TASK_SYNC_JOB) {
      await processCrmthinkTaskSync(job.data as CrmthinkTaskSyncJob)
      return
    }

    workerLogger.error(
      {
        app: 'product-updates',
        queue: CRMTHINK_TASK_SYNC,
        jobId: job.id,
        jobName: job.name,
      },
      'Job de nome desconhecido na fila de tarefas das novidades — descartado',
    )
  },
  {
    ...bullBaseOptions,
    concurrency: 1,
  },
)

crmthinkTaskSyncWorker.on('failed', (job, err) => {
  const data = job?.data as Partial<CrmthinkTaskSyncJob> | undefined

  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'product-updates',
      queue: CRMTHINK_TASK_SYNC,
      jobId: job?.id,
      jobName: job?.name,
      taskId: data?.taskId,
      traceKey: data?.traceKey,
      attemptsMade: job?.attemptsMade,
      attemptsAllowed: job?.opts.attempts,
      ...jobFailureLogFields(err),
    },
    'Job de releitura da tarefa da novidade falhou',
  )
})

crmthinkTaskSyncWorker.on('ready', () => {
  workerLogger.info(
    {
      event: 'worker.ready',
      app: 'product-updates',
      queue: CRMTHINK_TASK_SYNC,
      crmthinkTasksSyncEnabled: env.crmthinkTasks.syncEnabled,
    },
    'CRMThink task sync worker is ready',
  )
})
