import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { AddBiconnectorController } from '../presentation/controllers/add-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'

export const makeAddBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(req)
  return new AddBiconnectorController(bitrix)
}
