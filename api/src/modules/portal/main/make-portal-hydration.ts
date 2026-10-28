import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { redisConnection } from '@/queue/redis-connection'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { AplicationMirrorReader } from '@/modules/application/domain/repositories/aplication.repository'
import { PortalHydrationDeps } from '../application/helpers/hydrate-portal-apps'

/**
 * Leitor de títulos da SPA 1060, sozinho — o que a **listagem** de clientes precisa.
 *
 * Separado da árvore inteira porque a listagem não resolve contrato: montar
 * repositórios de assinatura, plano e produto para ler título seria pagar construção de
 * cache que ninguém consulta naquela rota.
 */
export const makeAplicationTitleReader = (): AplicationMirrorReader =>
  new BitrixAplicationTitleReader(
    new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
  )

/**
 * Dependências de hidratação do **detalhe** do cliente: título, assinaturas e itens.
 *
 * Os decorators de cache são os mesmos de `makeGetAplicationContext`, com chaves
 * derivadas de constantes de módulo — então a sessão de suporte que abre o mesmo cliente
 * várias vezes paga a leitura do Bitrix uma vez, e uma escrita em item invalida o que
 * esta tela lê.
 *
 * Portal **interno** da CRMThink, como o resto do billing: as SPAs vivem no CRM da
 * CRMThink com credencial de servidor.
 */
export const makePortalHydration = (): PortalHydrationDeps => {
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const titles = new BitrixAplicationTitleReader(bitrixClient)

  const aplications = new PrismaAplicationRepository(prisma, titles)

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

  return { titles, subscriptions, items: makeSubscriptionItemRepository() }
}
