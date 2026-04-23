import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { CancelConnectorController } from '../../presentation/controllers/connector/cancel-connector.controller'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeCancelConnectorController = (): Controller => {
  const connectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()
  const billingRepository = new PrismaBillingSubscriptionRepository()
  const appRepository = new PrismaInstalledAppRepository()
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  return new CancelConnectorController(
    connectorRepository,
    connectorRepository,
    instanceRepository,
    instanceRepository,
    billingRepository,
    billingRepository,
    appRepository,
    zApiClient,
  )
}
