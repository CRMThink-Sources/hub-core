import { Controller } from '@/shared/presentation/controller'
import { StripeWebhookHandlerController } from '../presentation/controllers/stripe-webhook-handler.controller'
import { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { StripeEventHandler } from '@/shared/infra/handlers/stripe-event-handler'
import { CheckoutSessionCompletedHandler } from '@/shared/infra/handlers/checkout-session-completed.handler'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { ZApiClient } from '../infra/clients/z-api.client'
import { env } from '@/config/env'
import { ZApiInstanceGateway } from '../infra/persistence/gateway/instance.gateway'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { GetOrCreateInstalledApp } from '@/shared/application/get-or-create-installed-app'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeStripeWebhookHandlerController = (): Controller => {
  const registry = new EventRegistry<StripeEventHandler>()
  const zApiClient = new ZApiClient(env.zApi.partnerToken)
  const createInstanceGateway = new ZApiInstanceGateway(zApiClient)
  const createConnectorRepo = new PrismaConnectorRepository()
  const createInstanceRepo = new PrismaInstanceRepository()
  const getApp = new PrismaInstalledAppRepository()

  const checkoutSessionCompletedHandler = new CheckoutSessionCompletedHandler(
    createConnectorRepo,
    createInstanceGateway,
    createInstanceRepo,
    getApp,
  )

  registry.register(checkoutSessionCompletedHandler)

  return new StripeWebhookHandlerController(registry)
}
