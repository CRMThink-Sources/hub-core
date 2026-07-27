import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { logger } from '@/shared/infra/logger'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import {
  SubscriptionStatus,
  canAdjustSubscriptionQuantity,
} from '@/shared/domain/entities/billing-subscription'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import {
  normalizeTiers,
  type NormalizedTier,
} from '@/modules/thinkzap/application/stripe-thinkzap-price-tiers'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100
}

function computeEstimatedAmount(
  tiers: NormalizedTier[],
  tiersMode: string | null,
  quantity: number,
): number | null {
  if (tiers.length === 0 || quantity < 1) return null

  if (tiersMode === 'volume') {
    const tier =
      tiers.find(t => t.toQuantity === null || quantity <= t.toQuantity) ??
      tiers[tiers.length - 1]
    if (!tier) return null
    return (
      quantity * centsToAmount(tier.unitAmountCents) +
      centsToAmount(tier.flatAmountCents)
    )
  }

  // graduated
  let total = 0
  for (const tier of tiers) {
    const from = tier.fromQuantity
    const to = tier.toQuantity ?? Number.MAX_SAFE_INTEGER
    if (quantity < from) break
    const effectiveUpper = Math.min(quantity, to)
    const unitsInTier = effectiveUpper - from + 1
    if (unitsInTier > 0) {
      total += centsToAmount(tier.flatAmountCents)
      total += unitsInTier * centsToAmount(tier.unitAmountCents)
    }
    if (tier.toQuantity === null) break
  }
  return total
}

export class PreviewAddQuantityController extends Controller {
  private readonly stripe: Stripe

  constructor(
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly getApp: GetInstalledAppRepository,
  ) {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        additionalQuantity: z.coerce.number().int().min(1).max(50),
        provider: z
          .enum([ConnectorProvider.ZAPI, ConnectorProvider.HUBMESSAGE])
          .default(ConnectorProvider.ZAPI),
      })
      .safeParse(req.query)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const appId = req.appId
    const domainId = req.domainId
    const priceId =
      parsed.data.provider === ConnectorProvider.HUBMESSAGE
        ? env.hubmessageStripePriceId
        : env.thinkzapStripePriceId

    if (!appId || !domainId) {
      return this.badRequest(new Error('Invalid request'))
    }
    if (!priceId) {
      return this.badRequest(
        new Error(
          `Price do provider ${parsed.data.provider} não configurado na API`,
        ),
      )
    }

    const app = await this.getApp.getByAppCodeAndDomainId(appId, domainId)
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const billing = await this.getBilling.getByAppId(app.id)
    if (!billing) {
      return this.badRequest(
        new Error(
          'Nenhuma assinatura encontrada. Use o checkout para contratar.',
        ),
      )
    }

    if (billing.status === SubscriptionStatus.TRIALING) {
      return this.badRequest(
        new Error(
          'No período de trial não é possível contratar linhas adicionais. Efetive a assinatura primeiro.',
        ),
      )
    }

    if (!canAdjustSubscriptionQuantity(billing.status)) {
      return this.badRequest(
        new Error(
          'Esta assinatura não permite alteração de quantidade. Contrate novamente pelo checkout.',
        ),
      )
    }

    const { additionalQuantity } = parsed.data

    logger.info(
      { appId, domainId, additionalQuantity },
      'preview-add-quantity: consultando Stripe',
    )

    const [stripeSubscription, stripePrice] = await Promise.all([
      this.stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
        expand: ['items.data.price', 'discounts.source.coupon'],
      }),
      this.stripe.prices.retrieve(priceId, {
        expand: ['tiers', 'currency_options'],
      }),
    ])

    // Sem line item para esse provider = produto ainda não contratado (qty atual 0).
    const line = stripeSubscription.items.data.find(
      item => item.price.id === priceId,
    )
    const currentQuantity = line?.quantity ?? 0
    const newQuantity = currentQuantity + additionalQuantity

    const tiers = normalizeTiers(stripePrice)
    const tiersMode = stripePrice.tiers_mode ?? null

    const estimatedMonthlyAmount = computeEstimatedAmount(
      tiers,
      tiersMode,
      newQuantity,
    )

    // Cupom: discounts é array; filtra strings (não expandidas)
    const firstDiscount = (stripeSubscription.discounts ?? [])[0]
    const activeDiscount =
      firstDiscount != null && typeof firstDiscount !== 'string'
        ? firstDiscount
        : null

    // source.coupon pode ser string (ID) ou Stripe.Coupon (quando expandido)
    const couponRaw = activeDiscount?.source?.coupon ?? null
    const coupon =
      couponRaw != null && typeof couponRaw !== 'string' ? couponRaw : null

    let discount: {
      name: string | null
      percentOff: number | null
      amountOff: number | null
      currency: string | null
      estimatedAmountWithDiscount: number | null
    } | null = null

    if (coupon) {
      const percentOff = coupon.percent_off ?? null
      const amountOff =
        coupon.amount_off != null ? centsToAmount(coupon.amount_off) : null

      let estimatedAmountWithDiscount: number | null = null
      if (estimatedMonthlyAmount != null) {
        if (percentOff != null) {
          estimatedAmountWithDiscount =
            estimatedMonthlyAmount * (1 - percentOff / 100)
        } else if (amountOff != null) {
          estimatedAmountWithDiscount = Math.max(
            0,
            estimatedMonthlyAmount - amountOff,
          )
        }
      }

      discount = {
        name: coupon.name ?? null,
        percentOff,
        amountOff,
        currency: coupon.currency ?? null,
        estimatedAmountWithDiscount,
      }
    }

    logger.info(
      {
        appId,
        domainId,
        currentQuantity,
        additionalQuantity,
        newQuantity,
        estimatedMonthlyAmount,
        hasDiscount: discount !== null,
      },
      'preview-add-quantity: preview calculado',
    )

    return this.ok({
      currentQuantity,
      additionalQuantity,
      newQuantity,
      currency: stripePrice.currency,
      estimatedMonthlyAmount,
      discount,
    })
  }
}
