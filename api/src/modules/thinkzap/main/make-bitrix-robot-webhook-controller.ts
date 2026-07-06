import { Controller } from '@/shared/presentation/controller'
import { BitrixRobotWebhookHandlerController } from '../presentation/controllers/bitrix-robot-webhook-handler.controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import {
  makeBitrixClient,
  makeBitrixClientByAppId,
} from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'

export const makeBitrixRobotWebhookHandlerController = async (
  request: Request,
): Promise<Controller> => {
  const getDomain = new PrismaDomainRepository()
  const getApp = new PrismaInstalledAppRepository()
  const getConnector = new PrismaConnectorRepository()
  const getInstance = new PrismaInstanceRepository()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  const domain = await getDomain.getDomain(request.body.auth.domain)
  if (!domain) {
    throw new Error('Domain not found')
  }
  const app = await getApp.getByAppCodeAndDomainId(
    'crmthink.thinkzap',
    domain.id,
  )
  if (!app) {
    throw new Error('App not found')
  }
  const bx = await makeBitrixClientByAppId(app.id)
  const sendNotification = new BitrixLivefeedNotificationService(bx)

  return new BitrixRobotWebhookHandlerController(
    getDomain,
    getApp,
    getConnector,
    getInstance,
    sendNotification,
    bx,
  )
}
