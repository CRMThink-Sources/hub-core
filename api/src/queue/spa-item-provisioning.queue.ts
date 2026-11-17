import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { spaEffectJobOptions } from './spa-effect-job-options'
import { apiLogger } from '@/shared/infra/logger'
import type { SpaEffectSource } from './spa-item-resource-sync.queue'

export const SPA_ITEM_PROVISIONING = 'spa-item-provisioning'

export type SpaItemProvisioningJob = {
  /** Id do item na SPA 1146, como vem em `data[FIELDS][ID]`. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
  /** Ver `SpaEffectSource`: o provisionamento só nasce do webhook da SPA. */
  source?: SpaEffectSource
}

/**
 * Fila do provisionamento de linha criada à mão na SPA de itens de assinatura.
 *
 * **Fila própria, não a `thinkzap-inbound`.** Aquela é o caminho quente de mensagem
 * recebida, com `concurrency: 10`: um job daqui — provisionamento no provider mais
 * ajuste de cobrança no gateway, de três a cinco idas à rede — ocupando slot lá
 * atrasaria entrega de mensagem de todos os clientes. Separada, ela também aparece
 * no bull-board sem competir com o volume do inbound, o que torna provisionamento
 * pendente visível.
 */
export const spaItemProvisioningQueue = new Queue<SpaItemProvisioningJob>(
  SPA_ITEM_PROVISIONING,
  bullBaseOptions,
)

/** Id de deduplicação do provisionamento de um item. */
export const spaItemProvisioningJobId = (itemId: string): string =>
  `spa-item-provision-${itemId}`

/**
 * Enfileira o provisionamento de um item.
 *
 * A reentrega do mesmo ADD pelo Bitrix roda depois do job em andamento, nunca em
 * paralelo com ele: dois provisionamentos simultâneos criariam dois recursos no
 * provider. Em sequência, o segundo encontra a credencial gravada e não provisiona.
 */
export async function enqueueSpaItemProvisioningJob(
  job: SpaItemProvisioningJob,
) {
  const created = await spaItemProvisioningQueue.add(
    'provision-line',
    job,
    spaEffectJobOptions(spaItemProvisioningJobId(job.itemId)),
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: SPA_ITEM_PROVISIONING,
      jobId: created.id,
      itemId: job.itemId,
      traceKey: job.traceKey,
    },
    'Provisionamento de item da SPA enfileirado',
  )

  return created
}
