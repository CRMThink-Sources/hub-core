import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'

import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'

/**
 * Abre o Stripe Customer Billing Portal — o cliente pode encerrar o trial,
 * atualizar cartão e gerenciar a assinatura antes de contratar mais linhas.
 */
export class CreateBillingPortalSessionController extends Controller {
  private readonly stripe: Stripe

  constructor(
    private readonly getBilling: GetBillingSubscriptionRepository,
    private readonly getApp: GetInstalledAppRepository,
  ) {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const domainId = req.domainId
    if (!domainId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const app = await this.getApp.getByDomainId(domainId)
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const billing = await this.getBilling.getByAppId(app.id)
    if (!billing) {
      return this.badRequest(new Error('Assinatura não encontrada.'))
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
    )

    const customer = subscription.customer
    const customerId =
      typeof customer === 'string' ? customer : (customer?.id ?? null)

    if (!customerId) {
      return this.badRequest(new Error('Cliente Stripe não encontrado.'))
    }

    const baseUrl = env.appUrl.replace(/\/$/, '')
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/thinkzap/financeiro`,
    })

    return this.ok({ url: portal.url })
  }
}
