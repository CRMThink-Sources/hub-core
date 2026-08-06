import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { BitrixSubscriptionItemRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscription-items.repository'
import { CachedSubscriptionItemRepository } from '@/modules/application/infra/cache/cached-subscription-item.repository'

/**
 * Repositório de item de assinatura, para quem precisa **escrever** no item.
 *
 * Decorado com o mesmo cache que `makeGetAplicationContext` usa. É isso que faz a
 * gravação de ajustes aparecer na leitura seguinte sem esperar o TTL: as chaves
 * são derivadas de constantes de módulo, então instâncias diferentes do decorator
 * invalidam e regravam exatamente as mesmas chaves que o contexto lê.
 *
 * Portal **interno** da CRMThink, como o resto do billing: as SPAs vivem no CRM
 * da CRMThink com credencial de servidor.
 */
export const makeSubscriptionItemRepository = (): SubscriptionItemRepository =>
  new CachedSubscriptionItemRepository(
    new BitrixSubscriptionItemRepository(
      new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
    ),
    redisConnection,
  )
