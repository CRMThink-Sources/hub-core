import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { CachedGatewaySubscriptionReader } from '@/modules/application/infra/cache/cached-gateway-subscription.reader'
import { CachedPlanPriceReader } from '@/modules/application/infra/cache/cached-plan-price.reader'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { RedisSpaItemResourceMirrorRepository } from '@/modules/application/infra/cache/redis-spa-item-resource-mirror.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { makeConnectorProviderResolver } from '@/modules/thinkzap/main/make-connector-provider-resolver'
import { ProviderResourceBilling } from '@/modules/thinkzap/application/provider-resource-billing'
import { CacheInvalidatingPaymentGateway } from '@/modules/thinkzap/infra/gateway/cache-invalidating-payment.gateway'
import { StripePaymentGateway } from '@/modules/thinkzap/infra/gateway/stripe-payment.gateway'
import { GatewaySubscriptionReader } from '@/modules/application/domain/repositories/gateway-subscription.reader'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Dependências das rotas de assinatura paga.
 *
 * Mesma fiação repetida do trial, e pelo mesmo motivo: `makeGetAplicationContext`
 * só expõe o caso de uso de leitura, e a contratação **escreve** nas SPAs. As
 * chaves de cache saem de constantes de módulo, então instâncias diferentes do
 * decorator invalidam exatamente as mesmas chaves que o contexto lê — e a
 * assinatura recém-criada aparece na leitura seguinte sem esperar o TTL.
 *
 * Portal **interno** da CRMThink, como o resto do billing.
 */
export function makeSubscriptionDeps() {
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

  /**
   * Um resolver só, compartilhado: o `ProviderResourceBilling` assina o recurso e a
   * criação de linha o provisiona — dois eixos do mesmo adapter, e duas instâncias
   * seriam dois clientes HTTP para o mesmo provider.
   */
  const providerResolver = makeConnectorProviderResolver({
    zApiClient,
    instanceGateway: new ZApiInstanceGateway(zApiClient),
  })

  return {
    bitrixClient,
    getAplicationContext: makeGetAplicationContext(),
    plans,
    subscriptions,
    items: makeSubscriptionItemRepository(),
    providerResolver,
    providerBilling: new ProviderResourceBilling(providerResolver),
    /**
     * O espelho do recurso, no mesmo Redis do cache — mas **sem TTL**, porque ele não é
     * cache: é a única cópia da credencial que sobrevive ao item apagado, e a marca de
     * desassinado que torna o gatilho de status idempotente.
     */
    mirrors: new RedisSpaItemResourceMirrorRepository(redisConnection),
  }
}

/**
 * O gateway de pagamento, ou `null` quando não configurado.
 *
 * `null` em vez de exceção na fiação: sem chave do gateway a instalação continua
 * inteira na modalidade boleto, e derrubar o boot por isso tiraria do ar o
 * caminho que não depende do gateway. Quem chama traduz a ausência para a resposta
 * certa da sua rota.
 *
 * Vem embrulhado no invalidador de cache **aqui**, e não em cada rota, porque é o
 * único ponto por onde todos os chamadores passam: quem alterar `line_items` amanhã
 * ganha a invalidação sem saber que ela existe. Sem isso, a tela seguinte à criação
 * de linha leria a quantidade antiga e mostraria a linha nova como bonificada.
 */
export function makePaymentGateway(): PaymentGateway | null {
  if (!env.payments.stripe.secretKey) return null

  return new CacheInvalidatingPaymentGateway(
    new StripePaymentGateway(),
    new CachedGatewaySubscriptionReader(
      new StripePaymentGateway(),
      redisConnection,
    ),
  )
}

/**
 * A leitura da assinatura no gateway, cacheada — ou `undefined` sem gateway
 * configurado.
 *
 * Mesma forma de `makePlanPriceReader`, e pelo mesmo motivo: sem chave a instalação
 * é boleto inteira, e quem recebe trata a ausência como "não sei o que é cobrado" —
 * o que leva a tela à forma reduzida, não a um valor inventado.
 */
export function makeGatewaySubscriptionReader():
  | GatewaySubscriptionReader
  | undefined {
  if (!env.payments.stripe.secretKey) return undefined

  return new CachedGatewaySubscriptionReader(
    new StripePaymentGateway(),
    redisConnection,
  )
}

/**
 * A leitura de preço no gateway, cacheada — ou `undefined` sem gateway configurado.
 *
 * Cacheada porque o preço é lido na abertura da tela de conexões e na listagem de
 * planos, e sem cache cada abertura custaria uma chamada ao gateway por plano.
 *
 * `undefined` em vez de exceção, pelo mesmo motivo de `makePaymentGateway`: sem chave,
 * a instalação continua inteira na modalidade boleto. Quem recebe trata a ausência
 * como "não sei o preço", e plano sem preço não é oferecido.
 */
export function makePlanPriceReader(): PlanPriceReader | undefined {
  const gateway = makePaymentGateway()
  if (!gateway) return undefined

  return new CachedPlanPriceReader(gateway, redisConnection)
}
