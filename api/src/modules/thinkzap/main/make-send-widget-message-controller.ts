import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { ZApiClient } from '../infra/clients/z-api.client'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { SendWidgetMessageController } from '../presentation/controllers/send-widget-message.controller'

export const makeSendWidgetMessageController = (): Controller => {
  const connectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  return new SendWidgetMessageController(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )
}
