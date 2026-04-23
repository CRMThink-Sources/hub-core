import { Controller } from '@/shared/presentation/controller'
import { EndTrialSubscriptionController } from '../presentation/controllers/end-trial-subscription.controller'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeEndTrialSubscriptionController = (): Controller => {
  const repo = new PrismaBillingSubscriptionRepository()
  const apps = new PrismaInstalledAppRepository()
  return new EndTrialSubscriptionController(repo, repo, apps)
}
