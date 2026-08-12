import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { BitrixSpaParentReader } from '@/modules/application/infra/bitrix/readers/bitrix-spa-parent.reader'
import { SpaWebhookController } from '@/modules/application/presentation/controllers/spa-webhook.controller'
import { enqueueSpaItemProvisioningJob } from '@/queue/spa-item-provisioning.queue'

/**
 * O `BitrixClient` aponta para o portal **interno** da CRMThink, onde as SPAs de
 * billing vivem — o mesmo de `makeGetAplicationContext`. O webhook de saída não
 * carrega token OAuth de instalação, e nem precisaria: a leitura do pai é sempre no
 * portal interno.
 */
export const makeSpaWebhookController = (): Controller => {
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  const invalidate = new InvalidateSpaCache(
    redisConnection,
    new BitrixSpaParentReader(bitrixClient),
  )

  /**
   * A função de enfileiramento entra como dependência, e não o caso de uso: o
   * provisionamento vive no `thinkzap`, e injetar a fila é o que mantém `payments` sem
   * dependência dele. Quem consome o job é o worker, num processo próprio.
   */
  return new SpaWebhookController(
    invalidate,
    env.bitrixSpaWebhookToken,
    enqueueSpaItemProvisioningJob,
  )
}
