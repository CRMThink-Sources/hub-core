import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { logger } from '@/shared/infra/logger'
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
import {
  resolveProviderQuantities,
  type ProviderPriceMap,
} from '@/shared/infra/stripe/thinkzap-subscription-line'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

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
    // Tela única: quantidades adicionais por provider. Compat: `additionalQuantity` → ZAPI.
    const parsed = z
      .object({
        additionalQuantity: z.number().int().min(1).max(50).optional(),
        additions: z
          .object({
            ZAPI: z.number().int().min(0).max(50).optional(),
            HUBMESSAGE: z.number().int().min(0).max(50).optional(),
          })
          .optional(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const additions: Partial<Record<ConnectorProvider, number>> = {}
    if (parsed.data.additions?.ZAPI) {
      additions[ConnectorProvider.ZAPI] = parsed.data.additions.ZAPI
    }
    if (parsed.data.additions?.HUBMESSAGE) {
      additions[ConnectorProvider.HUBMESSAGE] = parsed.data.additions.HUBMESSAGE
    }
    if (parsed.data.additionalQuantity) {
      additions[ConnectorProvider.ZAPI] =
        (additions[ConnectorProvider.ZAPI] ?? 0) +
        parsed.data.additionalQuantity
    }

    if (Object.keys(additions).length === 0) {
      return this.badRequest(
        new Error('Informe ao menos uma quantidade adicional'),
      )
    }

    const appId = req.appId
    const domainId = req.domainId
    const prices: ProviderPriceMap = {
      [ConnectorProvider.ZAPI]: env.thinkzapStripePriceId,
      [ConnectorProvider.HUBMESSAGE]: env.hubmessageStripePriceId,
    }

    if (!appId || !domainId) {
      return this.badRequest(new Error('Invalid request'))
    }
    for (const provider of Object.keys(additions) as ConnectorProvider[]) {
      if (!prices[provider]) {
        return this.badRequest(
          new Error(`Price do provider ${provider} não configurado na API`),
        )
      }
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

    logger.info(
      { appId, domainId, additions, billingId: billing.id },
      'add-subscription-quantity: iniciando adição de linhas',
    )

    const current = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    )

    // Para cada provider: bump do line item existente ou criação de um novo produto.
    const items: Stripe.SubscriptionUpdateParams.Item[] = []
    for (const provider of Object.keys(additions) as ConnectorProvider[]) {
      const priceId = prices[provider]
      const add = additions[provider] ?? 0
      if (add < 1) continue

      const line = current.items.data.find(item => item.price.id === priceId)
      if (line) {
        items.push({ id: line.id, quantity: (line.quantity ?? 0) + add })
      } else {
        items.push({ price: priceId, quantity: add })
      }
    }

    if (items.length === 0) {
      return this.badRequest(new Error('Nenhuma linha a adicionar'))
    }

    const updated = await this.stripe.subscriptions.update(
      billing.stripeSubscriptionId,
      {
        items,
        proration_behavior: 'create_prorations',
      },
    )

    const connectorQuantity = resolveProviderQuantities(updated, prices).reduce(
      (sum, pq) => sum + pq.quantity,
      0,
    )

    await this.updateBilling.syncFromStripe(updated.id, {
      status: fromStripeStatus(updated.status),
      trialEndsAt: updated.trial_end
        ? new Date(updated.trial_end * 1000)
        : null,
      connectorQuantity,
    })

    logger.info(
      {
        appId,
        domainId,
        additions,
        connectorQuantity,
        stripeSubscriptionId: updated.id,
      },
      'add-subscription-quantity: linhas adicionadas com sucesso',
    )

    return this.ok({
      connectorQuantity,
      stripeSubscriptionId: updated.id,
      provisioning: 'pending_webhook_sync',
    })
  }
}
