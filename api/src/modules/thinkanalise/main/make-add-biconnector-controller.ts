import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { AddBiconnectorController } from '../presentation/controllers/add-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { PrismaBiConnectorRepository } from '../infra/persistence/repositories/prisma-bi-connector.repository'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeAddBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = (await makeBitrixClient(
    req,
    'biconnector',
  )) as BitrixBiConnectorClient
  const biConnectorRepository = new PrismaBiConnectorRepository()
  const getApp = new PrismaInstalledAppRepository()
  return new AddBiconnectorController(bitrix, biConnectorRepository, getApp)
}
