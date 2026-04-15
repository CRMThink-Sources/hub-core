import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

import {
  computeThinkzapLineTotalCents,
  normalizeTiers,
} from '@/modules/thinkzap/application/stripe-thinkzap-price-tiers'

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100
}

export class GetThinkzapPricingController extends Controller {
  private readonly stripe: Stripe

  constructor() {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const priceId = env.thinkzapStripePriceId
    if (!priceId) {
      return this.badRequest(
        new Error('THINKZAP_PRICE_CONNECTORS não configurado na API'),
      )
    }

    const qParsed = z
      .object({
        quantity: z.coerce.number().min(1).max(500).optional(),
      })
      .safeParse(req.query)

    if (!qParsed.success) {
      return this.badRequest(
        new Error('Parâmetro quantity inválido: ' + qParsed.error.message),
      )
    }

    const quantity = qParsed.data.quantity

    const price = await this.stripe.prices.retrieve(priceId, {
      // Sem expand, o Stripe devolve billing_scheme=tiered mas `tiers` vazio.
      expand: ['tiers', 'currency_options'],
    })

    const tiers = normalizeTiers(price)
    const tiersMode = price.tiers_mode ?? null

    let estimate: {
      quantity: number
      totalAmountCents: number
      totalAmount: number
    } | null = null

    if (quantity != null) {
      const totalCents = computeThinkzapLineTotalCents(quantity, price)
      estimate = {
        quantity,
        totalAmountCents: totalCents,
        totalAmount: centsToAmount(totalCents),
      }
    }

    const firstTier = tiers[0]
    const firstTierUnit =
      price.billing_scheme === 'tiered' && firstTier
        ? centsToAmount(firstTier.unitAmountCents)
        : price.unit_amount != null
          ? centsToAmount(price.unit_amount)
          : null

    return this.ok({
      currency: price.currency,
      billingScheme: price.billing_scheme,
      tiersMode,
      tiers: tiers.map(t => ({
        fromQuantity: t.fromQuantity,
        toQuantity: t.toQuantity,
        unitAmount: centsToAmount(t.unitAmountCents),
        flatAmount: centsToAmount(t.flatAmountCents),
        unitAmountCents: t.unitAmountCents,
        flatAmountCents: t.flatAmountCents,
      })),
      firstTierUnitAmount: firstTierUnit,
      estimate,
    })
  }
}
