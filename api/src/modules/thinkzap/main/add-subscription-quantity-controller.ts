import { Controller } from '@/shared/presentation/controller'
import { AddSubscriptionQuantityController } from '../presentation/controllers/add-subscription-quantity.controller'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeAddSubscriptionQuantityController = (): Controller => {
  const repo = new PrismaBillingSubscriptionRepository()
  const appRepo = new PrismaInstalledAppRepository()
  return new AddSubscriptionQuantityController(repo, repo, appRepo)
}
