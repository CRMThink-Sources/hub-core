import { Controller } from '@/shared/presentation/controller'
import { ActivateTrialController } from '../presentation/controllers/activate-trial.controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Request } from 'express'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { BitrixSpaRepository } from '@/shared/infra/persistence/repositories/bitrix-spa.repository'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { makeProvisionMissingConnectorsDeps } from './make-provision-connectors-deps'

export const makeActivateTrialController = (req: Request): Controller => {
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const getApp = new PrismaInstalledAppRepository()
  const getDomain = new PrismaDomainRepository()

  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const spaRepository = new BitrixSpaRepository(bitrixClient)

  const createSubscriptionRepo = new PrismaBillingSubscriptionRepository()

  const provisionDeps = makeProvisionMissingConnectorsDeps()

  return new ActivateTrialController(
    getApp,
    getDomain,
    bitrix,
    createSubscriptionRepo,
    spaRepository,
    provisionDeps,
  )
}
