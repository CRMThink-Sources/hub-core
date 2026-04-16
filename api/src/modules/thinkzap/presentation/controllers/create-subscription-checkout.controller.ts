import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'

export class CreateSubscriptionCheckoutController extends Controller {
  private readonly stripe: Stripe

  constructor() {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        priceId: z.string(),
        quantity: z.number().min(1).max(10).default(1),
        mode: z.enum(['trial', 'subscription']),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { priceId, quantity, mode } = params.data
    const domainId = req.domainId
    const appId = req.appId

    if (!domainId || !appId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const parsedQuantity = Math.min(
      THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS,
      Math.max(1, Math.floor(Number(quantity))),
    )

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: parsedQuantity }],
      metadata: { appId, domainId, quantity: String(parsedQuantity) },
      allow_promotion_codes: true,
      payment_method_collection: 'if_required',
      return_url: `${env.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    }

    if (mode === 'trial') {
      checkoutParams.subscription_data = {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      }
    }

    const checkout = await this.stripe.checkout.sessions.create(checkoutParams)

    return this.ok({ clientSecret: checkout.client_secret })
  }
}
