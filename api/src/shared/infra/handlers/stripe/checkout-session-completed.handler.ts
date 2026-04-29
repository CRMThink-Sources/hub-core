import Stripe from 'stripe'

import { env } from '@/config/env'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { CreateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/create-billing-subscription.repository'
import {
  SubscriptionStatus,
  fromStripeStatus,
} from '@/shared/domain/entities/billing-subscription'

import {
  provisionMissingConnectorsForApp,
  type ProvisionMissingConnectorsDeps,
} from '@/modules/thinkzap/application/provision-missing-connectors'
import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'
import { getThinkzapConnectorQuantity } from '@/shared/infra/stripe/thinkzap-subscription-line'
import { StripeEventHandler } from '../stripe-event-handler'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import { UpdateSpaRepository } from '@/shared/domain/repositories/spa/update-spa.repository'
import { STATUS_OPTIONS } from '@/shared/domain/config/bitrix.env'

interface IStripeMetadata {
  domainId: string
  appId: string
  quantity: string
  trial_sub?: string | null
}

export class CheckoutSessionCompletedHandler implements StripeEventHandler {
  eventType = 'checkout.session.completed'
  private readonly stripe: Stripe = new Stripe(env.stripe.secretKey)

  constructor(
    private readonly getApp: GetInstalledAppRepository,
    private readonly getDomainRepository: GetDomainRepository,
    private readonly createSubscriptionRepo: CreateBillingSubscriptionRepository,
    private readonly provisionDeps: ProvisionMissingConnectorsDeps,
    private readonly spaRepository: GetSpaRepository & UpdateSpaRepository,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata as unknown as IStripeMetadata
    const { domainId, appId, quantity } = metadata

    const domain = await this.getDomainRepository.getDomainById(domainId)
    if (!domain) throw new Error('Domain not found')

    const installedApp = await this.getApp.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!installedApp) throw new Error('App not found')

    const spa = await this.spaRepository.get({
      appId: installedApp.appCodeId,
      domain: domain.name,
    })

    if (spa) {
      await this.spaRepository.update({
        appId: installedApp.appCodeId,
        domain: domain.name,
        status: 'active',
      })
    }

    if (metadata.trial_sub) {
      const billing =
        await this.provisionDeps.billingSubscriptionRepo.getByStripeSubscriptionId(
          metadata.trial_sub,
        )

      if (billing) {
        await this.provisionDeps.billingSubscriptionRepo.update(billing.id, {
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: session.subscription as string,
        })
      }

      await provisionMissingConnectorsForApp(
        this.provisionDeps,
        installedApp.id,
        1,
        { isTrialing: false },
      )

      await this.stripe.subscriptions.update(metadata.trial_sub, {
        trial_end: 'now',
      })
      return
    }

    const stripeSubscriptionId = session.subscription as string | null
    let slots = Math.max(1, Math.floor(Number(quantity ?? 1)))
    let subscriptionObj: Stripe.Subscription | null = null

    if (stripeSubscriptionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')
      subscriptionObj = await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        { expand: ['items.data.price'] },
      )
      const isTrialing = subscriptionObj.status === 'trialing'
      if (isTrialing) {
        slots = Math.min(slots, THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS)
      }
    }

    if (stripeSubscriptionId && subscriptionObj) {
      const priceId = env.thinkzapStripePriceId
      const connectorQty = priceId
        ? getThinkzapConnectorQuantity(subscriptionObj, priceId)
        : Number(quantity ?? 1)

      await this.createSubscriptionRepo.create({
        appId: installedApp.id,
        stripeSubscriptionId,
        status:
          subscriptionObj.status === 'trialing'
            ? SubscriptionStatus.TRIALING
            : fromStripeStatus(subscriptionObj.status),
        connectorQuantity: connectorQty,
        trialEndsAt: subscriptionObj.trial_end
          ? new Date(subscriptionObj.trial_end * 1000)
          : null,
      })
    }
  }
}
