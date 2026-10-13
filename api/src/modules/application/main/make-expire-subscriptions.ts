import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { redisConnection } from '@/queue/redis-connection'
import { ExpireSubscriptions } from '@/modules/application/application/expire-subscriptions'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixExpiringSubscriptionLister } from '@/modules/application/infra/bitrix/readers/bitrix-expiring-subscription.lister'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'

/**
 * Monta a varredura de expiração. A gravação passa pelo repositório com cache para
 * a leitura seguinte já ver o status novo, sem esperar o webhook da SPA invalidar.
 *
 * Portal **interno** da CRMThink, como em `makeGetAplicationContext`: a SPA 1142
 * vive no CRM da CRMThink.
 */
export const makeExpireSubscriptions = (): ExpireSubscriptions => {
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  const aplications = new PrismaAplicationRepository(
    prisma,
    new BitrixAplicationTitleReader(bitrixClient),
  )

  const products = new CachedProductRepository(
    new BitrixProductRepository(bitrixClient),
    redisConnection,
  )

  const plans = new CachedPlanRepository(
    new BitrixPlanRepository(bitrixClient, products),
    redisConnection,
  )

  const subscriptions = new CachedSubscriptionRepository(
    new BitrixSubscriptionRepository(bitrixClient, plans, aplications),
    redisConnection,
  )

  return new ExpireSubscriptions(
    new BitrixExpiringSubscriptionLister(bitrixClient),
    subscriptions,
    env.payments.expiration.manualGraceDays,
  )
}
