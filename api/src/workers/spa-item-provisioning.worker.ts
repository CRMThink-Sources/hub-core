import { env } from '@/config/env'
import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  SPA_ITEM_PROVISIONING,
  SpaItemProvisioningJob,
} from '@/queue/spa-item-provisioning.queue'
import { workerLogger } from '@/shared/infra/logger'
import { processSpaItemProvisioning } from './spa-item-provisioning.processor'
import { jobFailureLogFields } from '@/shared/infra/log-error'

// concurrency baixa: provider e gateway de pagamento têm rate limit próprio.
export const spaItemProvisioningWorker = new Worker(
  SPA_ITEM_PROVISIONING,
  async job => {
    await processSpaItemProvisioning(job.data as SpaItemProvisioningJob)
  },
  {
    ...bullBaseOptions,
    concurrency: 2,
  },
)

spaItemProvisioningWorker.on('failed', (job, err) => {
  const data = job?.data as SpaItemProvisioningJob | undefined

  // Log de transporte (tentativas); o código de erro do catálogo já foi logado no caso de uso.
  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'thinkzap',
      queue: SPA_ITEM_PROVISIONING,
      jobId: job?.id,
      itemId: data?.itemId,
      traceKey: data?.traceKey,
      attemptsMade: job?.attemptsMade,
      attemptsAllowed: job?.opts.attempts,
      ...jobFailureLogFields(err),
    },
    'Provisionamento de item da SPA falhou',
  )
})

spaItemProvisioningWorker.on('ready', () => {
  workerLogger.info(
    {
      event: 'worker.ready',
      app: 'thinkzap',
      queue: SPA_ITEM_PROVISIONING,
      spaProviderEffectsEnabled: env.payments.spa.providerEffectsEnabled,
    },
    'SPA item provisioning worker is ready',
  )
})
