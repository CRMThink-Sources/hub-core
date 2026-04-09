import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { DeleteBiconnectorController } from '../presentation/controllers/delete-biconnector.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'

export const makeDeleteBiconnectorController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(req)
  return new DeleteBiconnectorController(bitrix)
}
