import { Controller } from '@/shared/presentation/controller'
import { PreviewAddQuantityController } from '../presentation/controllers/preview-add-quantity.controller'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makePreviewAddQuantityController = (): Controller => {
  const billingRepo = new PrismaBillingSubscriptionRepository()
  const appRepo = new PrismaInstalledAppRepository()
  return new PreviewAddQuantityController(billingRepo, appRepo)
}
