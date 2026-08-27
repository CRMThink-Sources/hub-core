import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { GatewaySubscriptionCacheInvalidator } from '@/modules/application/domain/repositories/gateway-subscription-cache.invalidator'
import { PlanPrice } from '@/modules/thinkzap/domain/plan-pricing'
import {
  CheckoutSession,
  CreateBillingPortalSessionInput,
  CreateCheckoutSessionInput,
  GatewayEvent,
  PaymentGateway,
  SyncSubscriptionLineItemsInput,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'

/**
 * Gateway que descarta a leitura cacheada da assinatura depois de mexer nela.
 *
 * **Decorator, e não invalidação em cada caso de uso**, porque `syncSubscriptionLineItems`
 * tem três chamadores hoje — criação de linha adicional, provisionamento a partir do
 * item da SPA e limpeza de item apagado — e nada impede um quarto. Com a invalidação
 * escrita em cada um, o quarto nasce sem ela, e o sintoma não é erro: é a linha
 * recém-cobrada aparecendo como **bonificada** na tela do cliente. Aqui, nenhum
 * chamador pode esquecer.
 *
 * Envolve só a escrita que muda quantidade. Checkout não precisa: ele **cria** a
 * assinatura no gateway, e um id novo não tem entrada cacheada para descartar.
 */
export class CacheInvalidatingPaymentGateway implements PaymentGateway {
  constructor(
    private readonly inner: PaymentGateway,
    private readonly cache: GatewaySubscriptionCacheInvalidator,
  ) {}

  async syncSubscriptionLineItems(
    input: SyncSubscriptionLineItemsInput,
  ): Promise<void> {
    await this.inner.syncSubscriptionLineItems(input)
    await this.cache.invalidate(input.gatewaySubscriptionId)
  }

  verifyWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<GatewayEvent> {
    return this.inner.verifyWebhookEvent(rawBody, signature)
  }

  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    return this.inner.createCheckoutSession(input)
  }

  createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<{ url: string }> {
    return this.inner.createBillingPortalSession(input)
  }

  readPrice(priceId: string): Promise<PlanPrice> {
    return this.inner.readPrice(priceId)
  }

  readSubscription(
    gatewaySubscriptionId: string,
  ): Promise<GatewaySubscription> {
    return this.inner.readSubscription(gatewaySubscriptionId)
  }
}
