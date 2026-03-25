import { Controller } from '@/shared/presentation/controller'
import { VinculateChannelController } from '../../presentation/controllers/vinculate-channel.controller'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { Request } from 'express'
import { makeBitrixClient } from '../make-bitrix-client'

export const makeVinculateChannelController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  const getConnectorRepository = new PrismaConnectorRepository()

  return new VinculateChannelController(getConnectorRepository, bitrixClient)
}
