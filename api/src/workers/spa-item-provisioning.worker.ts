import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import {
  SPA_ITEM_PROVISIONING,
  SpaItemProvisioningJob,
} from '@/queue/spa-item-provisioning.queue'
import { workerLogger } from '@/shared/infra/logger'
import { processSpaItemProvisioning } from './spa-item-provisioning.processor'

/**
 * Worker do provisionamento de linha criada à mão na SPA 1146.
 *
 * `concurrency: 2`, e não os 10 do inbound: cada job fala com o provider e com o gateway
 * de pagamento, os dois com rate limit próprio. Criação manual é ato de operador — o
 * volume é baixo, e o que importa aqui é não empilhar chamadas a terceiros, não vazão.
 */
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

  /**
   * O caso de uso já registrou o código de erro do catálogo antes de propagar. Este log
   * é o do **transporte**: qual tentativa foi, e se ainda vem outra — é por ele que se
   * distingue "falhou e vai repetir" de "esgotou as tentativas e o item ficou pendente".
   */
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
      error: err,
    },
    'Provisionamento de item da SPA falhou',
  )
})

spaItemProvisioningWorker.on('ready', () => {
  workerLogger.info(
    { event: 'worker.ready', app: 'thinkzap', queue: SPA_ITEM_PROVISIONING },
    'SPA item provisioning worker is ready',
  )
})
