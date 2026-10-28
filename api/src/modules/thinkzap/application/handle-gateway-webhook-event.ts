import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { GatewayEvent } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { ActivateLineSubscription } from './activate-line-subscription'
import { ApplyGatewaySubscriptionState } from './apply-gateway-subscription-state'
import { ProviderResourceBilling } from './provider-resource-billing'

// Mesmo `gatewayId` em várias assinaturas da SPA (uma por plano): status vai para todas.
// Evento fora de ordem é ignorado com log; lançar faria o gateway reentregar em backoff.
// A aplicação do estado na SPA é de `ApplyGatewaySubscriptionState`, a mesma da
// sincronização Stripe — o webhook só traduz o evento e ignora o resultado.
export class HandleGatewayWebhookEvent {
  private readonly applyState: ApplyGatewaySubscriptionState

  constructor(
    private readonly activate: ActivateLineSubscription,
    subscriptions: SubscriptionRepository,
    items: SubscriptionItemRepository,
    providerBilling: ProviderResourceBilling,
  ) {
    this.applyState = new ApplyGatewaySubscriptionState(
      subscriptions,
      items,
      providerBilling,
    )
  }

  async execute(event: GatewayEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.completed':
        await this.activate.execute({
          domainId: event.installation.domainId,
          appCode: event.installation.appCode,
          planId: event.installation.planId,
          gatewaySubscriptionId: event.gatewaySubscriptionId,
          intent: event.intent,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
        })
        return

      case 'subscription.updated':
        await this.applyState.applyUpdate(
          event.gatewaySubscriptionId,
          {
            status: event.status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
          },
          event.totalLineQuantity,
        )
        return

      case 'subscription.deleted':
        await this.applyState.applyCancellation(event.gatewaySubscriptionId)
        return

      case 'ignored':
        apiLogger.info(
          { app: 'thinkzap', event: event.name },
          'Evento do gateway fora dos três tratados — ignorado',
        )
        return
    }
  }
}
