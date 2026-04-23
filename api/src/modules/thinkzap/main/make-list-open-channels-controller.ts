import { Controller } from '@/shared/presentation/controller'
import { ListOpenChannelsController } from '../presentation/controllers/list-open-channels.controller'
import { Request } from 'express'
import { makeBitrixClient } from '../../../shared/main/make-bitrix-client'

export const makeListOpenChannelsController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  return new ListOpenChannelsController(bitrixClient)
}
