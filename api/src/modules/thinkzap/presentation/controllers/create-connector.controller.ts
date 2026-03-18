import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

export class CreateConnectorController extends Controller {
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
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { priceId, quantity } = params.data
    const domainId = req.domainId
    const appId = req.appId

    if (!domainId || !appId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const parsedQuantity = Math.max(1, Math.floor(Number(quantity)))

    const checkout = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: parsedQuantity }],
      metadata: { appId, domainId, quantity: String(parsedQuantity) },
      allow_promotion_codes: true,
      payment_method_types: ['card', 'boleto'],
      payment_method_options: {
        boleto: {
          expires_after_days: 3,
        },
      },
      return_url: `${env.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    })

    return this.ok({ clientSecret: checkout.client_secret })
  }
}
