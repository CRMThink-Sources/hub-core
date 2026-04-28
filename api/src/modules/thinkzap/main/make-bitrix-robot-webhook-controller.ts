import { Controller } from '@/shared/presentation/controller'
import { BitrixRobotWebhookHandlerController } from '../presentation/controllers/bitrix-robot-webhook-handler.controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'

export const makeBitrixRobotWebhookHandlerController = (): Controller => {
  const getDomain = new PrismaDomainRepository()
  const getApp = new PrismaInstalledAppRepository()
  const getConnector = new PrismaConnectorRepository()
  const getInstance = new PrismaInstanceRepository()
  return new BitrixRobotWebhookHandlerController(
    getDomain,
    getApp,
    getConnector,
    getInstance,
  )
}
