import { Controller } from '@/shared/presentation/controller'
import { VinculateChannelController } from '../../presentation/controllers/vinculate-channel.controller'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { Request } from 'express'
import { makeBitrixClient } from '../../../../shared/main/make-bitrix-client'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'

export const makeVinculateChannelController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  const getConnectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()

  return new VinculateChannelController(
    getConnectorRepository,
    bitrixClient,
    instanceRepository,
  )
}
