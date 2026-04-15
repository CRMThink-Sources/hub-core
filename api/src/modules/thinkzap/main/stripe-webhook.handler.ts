import { Controller } from '@/shared/presentation/controller'
import { StripeWebhookHandlerController } from '../presentation/controllers/stripe-webhook-handler.controller'
import { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { StripeEventHandler } from '@/shared/infra/handlers/stripe-event-handler'
import { CheckoutSessionCompletedHandler } from '@/shared/infra/handlers/checkout-session-completed.handler'
import { CustomerSubscriptionUpdatedHandler } from '@/shared/infra/handlers/customer-subscription-updated.handler'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { makeProvisionMissingConnectorsDeps } from './make-provision-connectors-deps'

export const makeStripeWebhookHandlerController = (): Controller => {
  const registry = new EventRegistry<StripeEventHandler>()
  const getApp = new PrismaInstalledAppRepository()
  const getDomainRepository = new PrismaDomainRepository()
  const billingSubscriptionRepo = new PrismaBillingSubscriptionRepository()
  const provisionDeps = makeProvisionMissingConnectorsDeps()

  const checkoutSessionCompletedHandler = new CheckoutSessionCompletedHandler(
    getApp,
    getDomainRepository,
    billingSubscriptionRepo,
    provisionDeps,
  )

  const customerSubscriptionUpdatedHandler =
    new CustomerSubscriptionUpdatedHandler(
      billingSubscriptionRepo,
      billingSubscriptionRepo,
      provisionDeps,
    )

  registry.register(checkoutSessionCompletedHandler)
  registry.register(customerSubscriptionUpdatedHandler)

  return new StripeWebhookHandlerController(registry)
}
