import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { BitrixSpaParentReader } from '@/modules/application/infra/bitrix/readers/bitrix-spa-parent.reader'
import { SpaWebhookController } from '@/modules/application/presentation/controllers/spa-webhook.controller'

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

  return new SpaWebhookController(invalidate, env.bitrixSpaWebhookToken)
}
