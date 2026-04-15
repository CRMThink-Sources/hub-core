import { env } from '@/config/env'
import {
  SubscriptionStatus,
  fromStripeStatus,
} from '@/shared/domain/entities/billing-subscription'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import Stripe from 'stripe'
import z from 'zod'

import { getThinkzapConnectorQuantity } from '@/shared/infra/stripe/thinkzap-subscription-line'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { UpdateConnectorRepository } from '@/modules/thinkzap/domain/repositories/update-connector.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export class CancelConnectorController extends Controller {
  private readonly stripe: Stripe

  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly updateConnectorRepository: UpdateConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly updateInstanceRepository: UpdateInstanceRepository,
    private readonly getBillingRepository: GetBillingSubscriptionRepository,
    private readonly updateBillingRepository: UpdateBillingSubscriptionRepository,
    private readonly getAppRepository: GetInstalledAppRepository,
    private readonly zApiClient: ZApiClient,
  ) {
    super()
    this.stripe = new Stripe(env.stripe.secretKey ?? '')
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        connectorId: z.string().uuid(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const domainId = req.domainId
    const appId = req.appId
    const priceId = env.thinkzapStripePriceId

    if (!domainId || !appId) {
      return this.badRequest(new Error('Invalid request'))
    }
    if (!priceId) {
      return this.badRequest(
        new Error('THINKZAP_PRICE_CONNECTORS não configurado na API'),
      )
    }

    const app = await this.getAppRepository.getByDomainId(domainId ?? '')
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const connector = await this.getConnectorRepository.get(
      parsed.data.connectorId,
    )
    if (!connector || connector.appId !== app.id) {
      return this.notFound(new Error('Connector not found'))
    }

    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }
    if (!instance.zApiToken) {
      return this.badRequest(new Error('Instance token not found'))
    }

    const billing = await this.getBillingRepository.getByAppId(app.id)
    if (!billing) {
      return this.badRequest(new Error('Assinatura não encontrada.'))
    }

    if (
      billing.status !== SubscriptionStatus.ACTIVE &&
      billing.status !== SubscriptionStatus.TRIALING &&
      billing.status !== SubscriptionStatus.PAST_DUE
    ) {
      return this.badRequest(
        new Error(
          'Esta assinatura não permite redução de quantidade no momento.',
        ),
      )
    }

    const currentSubscription = await this.stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    )
    const line =
      currentSubscription.items.data.find(item => item.price.id === priceId) ??
      currentSubscription.items.data[0]

    if (!line) {
      return this.badRequest(new Error('Item de assinatura não encontrado'))
    }

    const currentQty = line.quantity ?? 1
    if (currentQty <= 1) {
      return this.badRequest(
        new Error('Não é possível cancelar o último conector da assinatura.'),
      )
    }

    const updatedSubscription = await this.stripe.subscriptions.update(
      billing.stripeSubscriptionId,
      {
        items: [{ id: line.id, quantity: currentQty - 1 }],
        proration_behavior: 'create_prorations',
      },
    )

    const connectorQuantity = getThinkzapConnectorQuantity(
      updatedSubscription,
      priceId,
    )
    await this.updateBillingRepository.syncFromStripe(updatedSubscription.id, {
      status: fromStripeStatus(updatedSubscription.status),
      trialEndsAt: updatedSubscription.trial_end
        ? new Date(updatedSubscription.trial_end * 1000)
        : null,
      connectorQuantity,
    })

    await this.zApiClient.updateInstance(
      instance.instanceId,
      'Cancelar',
      instance.zApiToken,
    )
    // Metodo com problema, utilizar posteriormente
    // await this.zApiClient.cancelInstance(
    //   instance.instanceId,
    //   instance.zApiToken,
    // )
    await this.updateInstanceRepository.markAsDisconnected(instance.id)
    await this.updateConnectorRepository.markAsInactive(connector.id)

    return this.ok({
      message: 'Conector cancelado com sucesso.',
      connectorQuantity,
      stripeSubscriptionId: updatedSubscription.id,
    })
  }
}
