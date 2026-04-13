import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { AddBiconnectorController } from '../presentation/controllers/add-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { PrismaBiConnectorRepository } from '../infra/persistence/repositories/prisma-bi-connector.repository'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'

export const makeAddBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = (await makeBitrixClient(
    req,
    'biconnector',
  )) as BitrixBiConnectorClient
  const biConnectorRepository = new PrismaBiConnectorRepository()
  return new AddBiconnectorController(bitrix, biConnectorRepository)
}
