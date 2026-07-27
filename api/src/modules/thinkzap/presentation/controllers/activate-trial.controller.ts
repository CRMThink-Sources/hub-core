import { env } from '@/config/env'
import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS,
} from '@/shared/domain/config/bitrix.env'
import { SubscriptionStatus } from '@/shared/domain/entities/billing-subscription'
import { CreateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/create-billing-subscription.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import z from 'zod'
import {
  ProvisionMissingConnectorsDeps,
  provisionMissingConnectorsForProvider,
} from '../../application/provision-missing-connectors'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

export class ActivateTrialController extends Controller {
  constructor(
    private readonly getApp: GetInstalledAppRepository,
    private readonly getDomain: GetDomainRepository,
    private readonly bitrix: BitrixClient,
    private readonly createSubscriptionRepo: CreateBillingSubscriptionRepository,
    private readonly spaRepository: GetSpaRepository,
    private readonly provisionDeps: ProvisionMissingConnectorsDeps,
    private readonly stripe: Stripe = new Stripe(env.stripe.secretKey),
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const domainId = req.domainId
    const appId = req.appId

    if (!domainId || !appId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const params = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        company: z.string().min(1),
        provider: z
          .enum([ConnectorProvider.ZAPI, ConnectorProvider.HUBMESSAGE])
          .default(ConnectorProvider.ZAPI),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { name, email, phone, company, provider } = params.data
    const priceId =
      provider === ConnectorProvider.HUBMESSAGE
        ? env.hubmessageStripePriceId
        : env.thinkzapStripePriceId

    if (!priceId) {
      return this.badRequest(
        new Error(`Price do provider ${provider} não configurado na API`),
      )
    }

    const app = await this.getApp.getByAppCodeAndDomainId(appId, domainId)
    const domain = await this.getDomain.getDomainById(domainId)

    if (!app || !domain) {
      return this.badRequest(new Error('App or domain not found'))
    }

    const spa = await this.spaRepository.get({
      appId,
      domain: domain.name,
    })

    if (!spa) {
      return this.badRequest(new Error('SPA not found'))
    }

    const customers = await this.stripe.customers.list({
      email,
    })

    let customer = customers.data[0]
    if (!customer) {
      customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          company,
        },
      })
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: 1 }],
      trial_period_days: 7,
      metadata: {
        appId,
        domainId,
        quantity: 1,
        provider,
      },
      trial_settings: {
        end_behavior: {
          // Trial vence (gera fatura) ao fim do prazo — não cancela.
          missing_payment_method: 'create_invoice',
        },
      },
    })

    await this.bitrix.updateCrmItem(BITRIX_ENTITY_TYPES.SPA_CLIENT, spa.id, {
      [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]: customer.id,
      [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]: new Date(
        subscription.trial_end ?? 0,
      ).toISOString(),
    })

    const sub = await this.createSubscriptionRepo.create({
      appId: app.id,
      connectorQuantity: 1,
      status: SubscriptionStatus.TRIALING,
      stripeSubscriptionId: subscription.id,
      trialEndsAt: new Date(subscription.trial_end ?? 0),
    })

    const { created } = await provisionMissingConnectorsForProvider(
      this.provisionDeps,
      sub.appId,
      provider,
      1,
      { isTrialing: true },
    )

    return this.ok({ message: 'Trial activated', created })
  }
}
