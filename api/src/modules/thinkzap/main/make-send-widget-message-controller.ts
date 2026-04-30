import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { ZApiClient } from '../infra/clients/z-api.client'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { SendWidgetMessageController } from '../presentation/controllers/send-widget-message.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'

export const makeSendWidgetMessageController = async (
  req: Request,
): Promise<Controller> => {
  const connectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const bitrix = await makeBitrixClient(req)
  const sendBitrixNotification = new BitrixLivefeedNotificationService(bitrix)

  return new SendWidgetMessageController(
    connectorRepository,
    instanceRepository,
    zApiClient,
    sendBitrixNotification,
  )
}
