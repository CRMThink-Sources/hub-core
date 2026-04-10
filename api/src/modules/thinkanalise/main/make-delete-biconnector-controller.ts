import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { DeleteBiconnectorController } from '../presentation/controllers/delete-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'

export const makeDeleteBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = (await makeBitrixClient(
    req,
    'biconnector',
  )) as BitrixBiConnectorClient
  return new DeleteBiconnectorController(bitrix)
}
