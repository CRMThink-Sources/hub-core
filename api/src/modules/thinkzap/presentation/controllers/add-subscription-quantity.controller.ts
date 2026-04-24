import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import {
  SubscriptionStatus,
  canAdjustSubscriptionQuantity,
  fromStripeStatus,
} from '@/shared/domain/entities/billing-subscription'
import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'
import { getThinkzapConnectorQuantity } from '@/shared/infra/stripe/thinkzap-subscription-line'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'

export class AddSubscriptionQuantityController extends Controller {
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
    const parsed = z
      .object({
        additionalQuantity: z.number().int().min(1).max(50),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const appId = req.appId
    const domainId = req.domainId
    const priceId = env.thinkzapStripePriceId

    if (!appId || !domainId) {
      return this.badRequest(new Error('Invalid request'))
    }
    if (!priceId) {
      return this.badRequest(
        new Error('THINKZAP_PRICE_CONNECTORS não configurado na API'),
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

    if (!canAdjustSubscriptionQuantity(billing.status)) {
      return this.badRequest(
        new Error(
          'Esta assinatura não permite alteração de quantidade. Contrate novamente pelo checkout.',
        ),
      )
    }

    const { additionalQuantity } = parsed.data

    const current = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    )

    const line =
      current.items.data.find(item => item.price.id === priceId) ??
      current.items.data[0]

    if (!line) {
      return this.badRequest(new Error('Item de assinatura não encontrado'))
    }

    const currentQty = line.quantity ?? 1

    if (billing.status === SubscriptionStatus.TRIALING) {
      if (
        currentQty + additionalQuantity >
        THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS
      ) {
        return this.badRequest(
          new Error(
            `No período de trial é possível contratar no máximo ${THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS} linhas.`,
          ),
        )
      }
    }

    const newQuantity = currentQty + additionalQuantity

    const updated = await this.stripe.subscriptions.update(
      billing.stripeSubscriptionId,
      {
        items: [{ id: line.id, quantity: newQuantity }],
        proration_behavior: 'create_prorations',
      },
    )

    const connectorQuantity = getThinkzapConnectorQuantity(updated, priceId)

    await this.updateBilling.syncFromStripe(updated.id, {
      status: fromStripeStatus(updated.status),
      trialEndsAt: updated.trial_end
        ? new Date(updated.trial_end * 1000)
        : null,
      connectorQuantity,
    })
    return this.ok({
      connectorQuantity: newQuantity,
      stripeSubscriptionId: updated.id,
      provisioning: 'pending_webhook_sync',
    })
  }
}
