import { Controller } from '@/shared/presentation/controller'
import { ListDestinationsController } from '../presentation/controllers/list-destinations.controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Request } from 'express'

export const makeListDestinationsController = async (
  request: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(request)
  return new ListDestinationsController(bitrix)
}
