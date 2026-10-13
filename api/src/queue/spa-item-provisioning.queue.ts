import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
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

/**
 * Id determinístico do job de um item.
 *
 * Separador `-`, **nunca** `:`: o BullMQ recusa id custom com dois-pontos
 * (`Custom Id cannot contain :`), porque é o separador das chaves dele no Redis. O
 * erro só aparece na chamada de `add`, então a única forma de travá-lo é aqui —
 * e é a mesma convenção de `import-<id>` e `hubmessage-<id>` no resto da API.
 */
export const spaItemProvisioningJobId = (itemId: string): string =>
  `spa-item-provision-${itemId}`

/**
 * Enfileira o provisionamento de um item.
 *
 * `jobId` determinístico por item: reentrega do mesmo evento pelo Bitrix — que
 * acontece, e é o comportamento dele quando o handler demora — é colapsada pelo
 * BullMQ em vez de virar um segundo provisionamento.
 *
 * A colapsagem vale enquanto o job está na fila ou retido no histórico de
 * concluídos. Ela **não** é a única defesa contra recurso duplicado: a guarda real é
 * a credencial já presente no item, verificada dentro do caso de uso, porque um
 * evento reentregue dias depois teria id livre de novo.
 */
export async function enqueueSpaItemProvisioningJob(
  job: SpaItemProvisioningJob,
) {
  const created = await spaItemProvisioningQueue.add('provision-line', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    jobId: spaItemProvisioningJobId(job.itemId),
  })

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
