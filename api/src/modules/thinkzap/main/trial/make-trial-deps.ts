import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { RedisSpaItemResourceMirrorRepository } from '@/modules/application/infra/cache/redis-spa-item-resource-mirror.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { makeConnectorProviderResolver } from '@/modules/thinkzap/main/make-connector-provider-resolver'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixSpaRepository } from '@/shared/infra/persistence/repositories/bitrix-spa.repository'

/**
 * Dependências das rotas de trial.
 *
 * O trial **escreve** na SPA de assinaturas, o que `makeGetAplicationContext` não
 * expõe — ele devolve só o caso de uso de leitura. Daí a fiação repetida aqui: as
 * chaves de cache saem de constantes de módulo, então instâncias diferentes do
 * decorator invalidam exatamente as mesmas chaves que o contexto lê, e a assinatura
 * recém-criada aparece na leitura seguinte sem esperar o TTL.
 *
 * Portal **interno** da CRMThink, como o resto do billing.
 */
export function makeTrialDeps() {
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

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  return {
    getAplicationContext: makeGetAplicationContext(),
    plans,
    subscriptions,
    /**
     * Contato do item de cliente na SPA 1060. Sem cache de propósito: é lido uma
     * vez por instalação elegível e escrito uma vez na vida dela, e cache aqui só
     * criaria a chance de a tela pré-preencher com valor que o CRM já não tem.
     */
    contacts: new BitrixSpaRepository(bitrixClient),
    items: makeSubscriptionItemRepository(),
    providerResolver: makeConnectorProviderResolver({
      zApiClient,
      instanceGateway: new ZApiInstanceGateway(zApiClient),
    }),
    /**
     * Espelho do recurso, **sem TTL** — não é cache. O trial é o caminho que mais deixa
     * recurso abandonado, e é ele que mais precisa da credencial sobreviver ao item.
     */
    mirrors: new RedisSpaItemResourceMirrorRepository(redisConnection),
  }
}
