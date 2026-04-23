import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { DisconnectChannelController } from '../../presentation/controllers/connector/disconnect-channel.controller'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'

export const makeDisconnectChannelController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  const getConnectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()

  return new DisconnectChannelController(
    bitrixClient,
    getConnectorRepository,
    instanceRepository,
  )
}
