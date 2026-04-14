import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { UpdateBiconnectorController } from '../presentation/controllers/update-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { PrismaBiConnectorRepository } from '../infra/persistence/repositories/prisma-bi-connector.repository'

export const makeUpdateBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = (await makeBitrixClient(
    req,
    'biconnector',
  )) as BitrixBiConnectorClient
  const repository = new PrismaBiConnectorRepository()
  return new UpdateBiconnectorController(bitrix, repository)
}
