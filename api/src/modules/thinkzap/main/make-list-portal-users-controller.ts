import { Controller } from '@/shared/presentation/controller'
import { ListPortalUsersController } from '../presentation/controllers/list-portal-users.controller'
import { Request } from 'express'
import { makeBitrixClient } from '../../../shared/main/make-bitrix-client'

export const makeListPortalUsersController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  return new ListPortalUsersController(bitrixClient)
}
