import { StripeEventHandler } from '../stripe-event-handler'
import Stripe from 'stripe'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import {
  ProvisionUpdateConnectorsDeps,
  deactivateConnectorsForApp,
} from '@/modules/thinkzap/application/provision-update-connectors'
import { fromStripeStatus } from '@/shared/domain/entities/billing-subscription'

export class CustomerSubscriptionDeletedHandler implements StripeEventHandler {
  eventType = 'customer.subscription.deleted'

  constructor(
    private readonly updateSubscriptionRepo: UpdateBillingSubscriptionRepository,
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly provisionUpdateDeps: ProvisionUpdateConnectorsDeps,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription
    const billingRow = await this.getBilling.getByStripeSubscriptionId(
      subscription.id,
    )

    if (!billingRow) {
      console.warn(
        '[stripe] customer.subscription.deleted: sem billing_subscriptions para',
        subscription.id,
      )
      return
    }

    const app = await this.provisionUpdateDeps.getApp.getById(billingRow.appId)
    if (!app) {
      console.warn(
        '[stripe] customer.subscription.deleted: sem app para',
        subscription.id,
      )
      return
    }

    const { deactivated } = await deactivateConnectorsForApp(
      this.provisionUpdateDeps,
      app.id,
    )

    await this.updateSubscriptionRepo.syncFromStripe(subscription.id, {
      status: fromStripeStatus(subscription.status),
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      connectorQuantity: 0,
    })

    console.log(
      `[stripe] customer.subscription.deleted: ${deactivated} conector(es) desativado(s) para app ${app.id}`,
    )
  }
}
