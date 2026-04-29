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
import z from 'zod'

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
    const params = z
      .object({
        priceId: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { priceId } = params.data

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
    if (!current) {
      return this.badRequest(new Error('Assinatura não encontrada.'))
    }
    const customer = (await this.stripe.customers.retrieve(
      current.customer as string,
    )) as Stripe.Customer

    if (current.status !== 'trialing') {
      return this.badRequest(
        new Error(
          'A assinatura não está em período de testes. Nada a efetivar.',
        ),
      )
    }

    try {
      const checkout = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        ui_mode: 'embedded',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { appId, domainId, quantity: 1, trial_sub: current.id },
        allow_promotion_codes: true,
        payment_method_collection: 'if_required',
        return_url: `${env.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      })
      return this.ok({ sessionId: checkout.client_secret })
    } catch (error) {
      const message = (error as Error).message.includes(
        'has no attached payment',
      )
        ? 'Subscription has no attached payment method. Please add a payment method to your account in the billing portal.'
        : 'Error activating trial.'
      return this.badRequest(new Error(message))
    }
  }
}
