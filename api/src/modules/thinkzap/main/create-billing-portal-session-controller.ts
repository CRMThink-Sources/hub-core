import { Controller } from '@/shared/presentation/controller'
import { CreateBillingPortalSessionController } from '../presentation/controllers/create-billing-portal-session.controller'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeCreateBillingPortalSessionController = (): Controller => {
  const billing = new PrismaBillingSubscriptionRepository()
  const apps = new PrismaInstalledAppRepository()
  return new CreateBillingPortalSessionController(billing, apps)
}
