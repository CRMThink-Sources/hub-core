import { env } from '@/config/env'
import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS,
} from '@/shared/domain/config/bitrix.env'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import z from 'zod'

export class ActivateTrialController extends Controller {
  private readonly stripe: Stripe = new Stripe(env.stripe.secretKey)

  constructor(
    private readonly getApp: GetInstalledAppRepository,
    private readonly getDomain: GetDomainRepository,
    private readonly bitrix: BitrixClient,
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
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { name, email, phone, company } = params.data

    const app = await this.getApp.getByAppCodeAndDomainId(appId, domainId)
    const domain = await this.getDomain.getDomainById(domainId)

    if (!app || !domain) {
      return this.badRequest(new Error('App or domain not found'))
    }

    let spaId: string | null = null

    const {
      result: { items },
    } = await this.bitrix.listCrmItems(BITRIX_ENTITY_TYPES.SPA_CLIENT, {
      [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: appId,
      [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: domain.name,
    })

    if (!items.length) {
      const response = await this.bitrix.createCrmItem(
        BITRIX_ENTITY_TYPES.SPA_CLIENT,
        {
          [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: appId,
          [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: domain.name,
          [BITRIX_SPA_CLIENT_FIELDS.MEMBER_ID]: domain.memberId,
          [BITRIX_SPA_CLIENT_FIELDS.NAME]: name,
          [BITRIX_SPA_CLIENT_FIELDS.EMAIL]: email,
          [BITRIX_SPA_CLIENT_FIELDS.PHONE]: phone,
          [BITRIX_SPA_CLIENT_FIELDS.COMPANY]: company,
        },
      )

      spaId = response.result.item.id
    } else {
      spaId = items[0]?.id ?? null
    }

    if (!spaId) {
      return this.badRequest(new Error('Failed to create CRM item'))
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
      items: [{ price: env.thinkzapStripePriceId, quantity: 1 }],
      trial_period_days: 7,
      metadata: {
        appId,
        domainId,
        quantity: 1,
      },
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
    })

    await this.bitrix.updateCrmItem(BITRIX_ENTITY_TYPES.SPA_CLIENT, spaId, {
      [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]: customer.id,
      [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]: new Date(
        subscription.trial_end ?? 0,
      ).toISOString(),
    })

    return this.ok({ message: 'Trial activated' })
  }
}
