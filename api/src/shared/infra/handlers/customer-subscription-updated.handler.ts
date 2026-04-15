import Stripe from 'stripe'

import { env } from '@/config/env'
import { StripeEventHandler } from './stripe-event-handler'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { fromStripeStatus } from '@/shared/domain/entities/billing-subscription'
import { getThinkzapConnectorQuantity } from '@/shared/infra/stripe/thinkzap-subscription-line'
import {
  provisionMissingConnectorsForApp,
  type ProvisionMissingConnectorsDeps,
} from '@/modules/thinkzap/application/provision-missing-connectors'

export class CustomerSubscriptionUpdatedHandler implements StripeEventHandler {
  eventType = 'customer.subscription.updated'

  constructor(
    private readonly updateSubscriptionRepo: UpdateBillingSubscriptionRepository,
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly provisionDeps: ProvisionMissingConnectorsDeps,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
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

    const priceId = env.thinkzapStripePriceId
    const connectorQuantity = priceId
      ? getThinkzapConnectorQuantity(subscription, priceId)
      : (subscription.items.data[0]?.quantity ?? 0)

    await this.updateSubscriptionRepo.syncFromStripe(subscription.id, {
      status: fromStripeStatus(subscription.status),
      trialEndsAt,
      connectorQuantity,
    })

    const { created } = await provisionMissingConnectorsForApp(
      this.provisionDeps,
      billingRow.appId,
      connectorQuantity,
      { isTrialing: subscription.status === 'trialing' },
    )
    if (created > 0) {
      console.log(
        `[stripe] provisionados ${created} conector(es) para app ${billingRow.appId} (meta ${connectorQuantity} linhas)`,
      )
    }
  }
}
