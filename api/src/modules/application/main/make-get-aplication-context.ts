import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { redisConnection } from '@/queue/redis-connection'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { PrismaCustomerRepository } from '@/modules/application/infra/prisma/repositories/prisma-customers.repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { BitrixSubscriptionItemRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscription-items.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { CachedSubscriptionItemRepository } from '@/modules/application/infra/cache/cached-subscription-item.repository'

/**
 * Monta o caso de uso do contexto da aplicação com a árvore completa de
 * repositórios, cada camada decorada pelo seu cache.
 *
 * Extraído da fábrica do controller porque outros módulos precisam do mesmo caso
 * de uso: as rotas de linha do thinkzap resolvem a credencial Z-API a partir do
 * item de assinatura, e é este caso de uso que devolve o item **com** o token —
 * a redação é da camada de apresentação, não do domínio.
 *
 * O cache é o que torna essa resolução viável por request: sem os decorators, cada
 * chamada pagaria 1 listagem de assinaturas + N listagens de itens + hidratação de
 * plano e produto.
 */
export const makeGetAplicationContext = (): GetAplicationContext => {
  /**
   * Portal **interno** da CRMThink, não o do cliente: as SPAs de billing
   * (1060 aplicação, 1134 produto, 1138 plano, 1142 assinatura, 1146 item) vivem
   * no CRM da CRMThink, com credencial de servidor. O token do chamador determina
   * apenas *qual* instalação é consultada.
   */
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

  // A assinatura não recebe `products`: o produto cobrado vem em `plan.product`.
  const subscriptions = new CachedSubscriptionRepository(
    new BitrixSubscriptionRepository(bitrixClient, plans, aplications),
    redisConnection,
  )

  const items = new CachedSubscriptionItemRepository(
    new BitrixSubscriptionItemRepository(bitrixClient),
    redisConnection,
  )

  const customers = new PrismaCustomerRepository(
    prisma,
    aplications,
    subscriptions,
  )

  return new GetAplicationContext(customers, aplications, subscriptions, items)
}
