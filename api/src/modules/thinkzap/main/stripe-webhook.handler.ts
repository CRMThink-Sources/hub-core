import { Controller } from '@/shared/presentation/controller'
import { StripeWebhookHandlerController } from '../presentation/controllers/stripe-webhook-handler.controller'
import { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { StripeEventHandler } from '@/shared/infra/handlers/stripe-event-handler'
import { CheckoutSessionCompletedHandler } from '@/shared/infra/handlers/stripe/checkout-session-completed.handler'
import { CustomerSubscriptionUpdatedHandler } from '@/shared/infra/handlers/stripe/customer-subscription-updated.handler'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { makeProvisionMissingConnectorsDeps } from './make-provision-connectors-deps'
import { CustomerSubscriptionDeletedHandler } from '@/shared/infra/handlers/stripe/customer-subscription-deleted.handler'
import { makeProvisionUpdateConnectorDeps } from './make-provision-update-connector-deps'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { BitrixSpaRepository } from '@/shared/infra/persistence/repositories/bitrix-spa.repository'

export const makeStripeWebhookHandlerController = (): Controller => {
  const registry = new EventRegistry<StripeEventHandler>()
  const getApp = new PrismaInstalledAppRepository()
  const getDomainRepository = new PrismaDomainRepository()
  const billingSubscriptionRepo = new PrismaBillingSubscriptionRepository()
  const provisionDeps = makeProvisionMissingConnectorsDeps()
  const provisionUpdateDeps = makeProvisionUpdateConnectorDeps()
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const spaRepository = new BitrixSpaRepository(bitrixClient)

  const checkoutSessionCompletedHandler = new CheckoutSessionCompletedHandler(
    getApp,
    getDomainRepository,
    billingSubscriptionRepo,
    provisionDeps,
    spaRepository,
  )

  const customerSubscriptionUpdatedHandler =
    new CustomerSubscriptionUpdatedHandler(
      billingSubscriptionRepo,
      billingSubscriptionRepo,
      provisionDeps,
    )

  const customerSubscriptionDeletedHandler =
    new CustomerSubscriptionDeletedHandler(
      billingSubscriptionRepo,
      billingSubscriptionRepo,
      provisionUpdateDeps,
    )

  registry.register(checkoutSessionCompletedHandler)
  registry.register(customerSubscriptionUpdatedHandler)
  registry.register(customerSubscriptionDeletedHandler)

  return new StripeWebhookHandlerController(registry)
}
