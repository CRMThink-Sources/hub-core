import Stripe from 'stripe'

import { env } from '@/config/env'
import { StripeEventHandler } from '../stripe-event-handler'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { fromStripeStatus } from '@/shared/domain/entities/billing-subscription'
import {
  resolveProviderQuantities,
  type ProviderPriceMap,
} from '@/shared/infra/stripe/thinkzap-subscription-line'
import {
  provisionMissingConnectorsForProvider,
  type ProvisionMissingConnectorsDeps,
} from '@/modules/thinkzap/application/provision-missing-connectors'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

export class CustomerSubscriptionUpdatedHandler implements StripeEventHandler {
  eventType = 'customer.subscription.updated'

  constructor(
    private readonly updateSubscriptionRepo: UpdateBillingSubscriptionRepository,
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly provisionDeps: ProvisionMissingConnectorsDeps,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    console.log('[stripe] customer.subscription.updated', event)
    const subscription = event.data.object as Stripe.Subscription

    const billingRow = await this.getBilling.getByStripeSubscriptionId(
      subscription.id,
    )
    if (!billingRow) {
      console.warn(
        '[stripe] customer.subscription.updated: sem billing_subscriptions para',
        subscription.id,
      )
      return
    }

    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null

    const prices: ProviderPriceMap = {
      [ConnectorProvider.ZAPI]: env.thinkzapStripePriceId,
      [ConnectorProvider.HUBMESSAGE]: env.hubmessageStripePriceId,
    }
    const providerQuantities = resolveProviderQuantities(subscription, prices)
    const connectorQuantity = providerQuantities.reduce(
      (sum, pq) => sum + pq.quantity,
      0,
    )

    await this.updateSubscriptionRepo.syncFromStripe(subscription.id, {
      status: fromStripeStatus(subscription.status),
      trialEndsAt,
      connectorQuantity,
    })

    const isTrialing = subscription.status === 'trialing'
    for (const { provider, quantity } of providerQuantities) {
      const { created } = await provisionMissingConnectorsForProvider(
        this.provisionDeps,
        billingRow.appId,
        provider,
        quantity,
        { isTrialing },
      )
      if (created > 0) {
        console.log(
          `[stripe] provisionados ${created} conector(es) ${provider} para app ${billingRow.appId} (meta ${quantity})`,
        )
      }
    }
  }
}
