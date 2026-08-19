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

/**
 * Worker da reconciliação entre o item da SPA 1146 e o recurso remoto dele.
 *
 * `concurrency: 2`, como o do provisionamento: cada job fala com o Bitrix, com o provider
 * e às vezes com o gateway, os três com rate limit próprio. A sincronização de status tem
 * volume maior que o provisionamento — toda edição de campo gera um evento —, e é
 * justamente por isso que a vazão não sobe: empilhar chamadas a terceiros por uma edição
 * em massa no CRM seria pior que a fila crescer.
 *
 * O nome do job escolhe o processor. Nome desconhecido é `error` e **não** propaga: um
 * job de um deploy futuro chegando a um worker antigo não deve virar retry infinito.
 */
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

  /**
   * O caso de uso já registrou o detalhe antes de propagar. Este log é o do **transporte**:
   * qual tentativa foi, e se ainda vem outra — é por ele que se distingue "falhou e vai
   * repetir" de "esgotou as tentativas, e o recurso ficou cobrado de nós".
   */
  workerLogger.error(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_RESOURCE_SYNC,
      jobId: job?.id,
      jobName: job?.name,
      itemId: data?.itemId,
      traceKey: data?.traceKey,
      attemptsMade: job?.attemptsMade,
      attemptsAllowed: job?.opts.attempts,
      error: err,
    },
    'Job de recurso do item da SPA falhou',
  )
})

spaItemResourceSyncWorker.on('ready', () => {
  workerLogger.info(
    { app: 'thinkzap', queue: SPA_ITEM_RESOURCE_SYNC },
    'SPA item resource sync worker is ready',
  )
})
