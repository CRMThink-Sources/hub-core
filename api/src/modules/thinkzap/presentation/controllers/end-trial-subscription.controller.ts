import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'

import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import { fromStripeStatus } from '@/shared/domain/entities/billing-subscription'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { getThinkzapConnectorQuantity } from '@/shared/infra/stripe/thinkzap-subscription-line'

/**
 * Encerra o trial imediatamente (cobrança conforme o plano). O Billing Portal
 * do Stripe muitas vezes não exibe "efetivar agora"; isso cobre esse caso.
 */
export class EndTrialSubscriptionController extends Controller {
  private readonly stripe: Stripe

  constructor(
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly updateBilling: UpdateBillingSubscriptionRepository,
    private readonly getApp: GetInstalledAppRepository,
  ) {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const domainId = req.domainId
    const appId = req.appId
    if (!domainId || !appId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const app = await this.getApp.getByAppCodeAndDomainId(appId, domainId)
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const billing = await this.getBilling.getByAppId(app.id)
    if (!billing) {
      return this.badRequest(new Error('Assinatura não encontrada.'))
    }

    const current = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    )

    if (current.status !== 'trialing') {
      return this.badRequest(
        new Error(
          'A assinatura não está em período de testes. Nada a efetivar.',
        ),
      )
    }

    await this.stripe.subscriptions.update(billing.stripeSubscriptionId, {
      trial_end: 'now',
    })

    const updated = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    )

    const trialEndsAt = updated.trial_end
      ? new Date(updated.trial_end * 1000)
      : null

    const priceId = env.thinkzapStripePriceId
    const connectorQuantity = priceId
      ? getThinkzapConnectorQuantity(updated, priceId)
      : (updated.items.data[0]?.quantity ?? 0)

    await this.updateBilling.syncFromStripe(updated.id, {
      status: fromStripeStatus(updated.status),
      trialEndsAt,
      connectorQuantity,
    })

    return this.ok({
      subscriptionStatus: updated.status,
    })
  }
}
