import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { ListBiconnectorsController } from '../presentation/controllers/list-biconnectors.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'

export const makeListBiconnectorsController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(req)
  return new ListBiconnectorsController(bitrix)
}
