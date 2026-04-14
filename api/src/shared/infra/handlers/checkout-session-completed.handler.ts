// handlers/checkout-session-completed.handler.ts
import Stripe from 'stripe'

import { CreateConnectorRepository } from '@/modules/thinkzap/domain/repositories/create-connector.repository'
import { StripeEventHandler } from './stripe-event-handler'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { randomUUID } from 'crypto'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'

export class CheckoutSessionCompletedHandler implements StripeEventHandler {
  eventType = 'checkout.session.completed'

  // injeta os repositórios que precisar via construtor
  constructor(
    private readonly createConnectorRepo: CreateConnectorRepository,
    private readonly createInstanceGateway: CreateInstanceGateway,
    private readonly createInstanceRepo: CreateInstanceRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly getDomainRepository: GetDomainRepository,
  ) {}

  async handle(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session
    const domainId = session.metadata?.domainId as string
    const appId = session.metadata?.appId as string

    const domain = await this.getDomainRepository.getDomainById(domainId)
    if (!domain) {
      throw new Error('Domain not found')
    }

    const instanceName = domain.name + ' | ' + `instance-${randomUUID()}`

    const instance = await this.createInstanceGateway.create(instanceName)

    const persistedInstance = await this.createInstanceRepo.create({
      domainId,
      instanceId: instance.id,
      phoneNumber: null,
      status: InstanceStatus.CONNECTED,
      zApiToken: instance.token,
      vinculatedChannel: null,
    })

    const installedApp = await this.getApp.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!installedApp) {
      throw new Error('App not found')
    }

    await this.createConnectorRepo.createConnector({
      instanceId: persistedInstance.id,
      appId: installedApp.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}
