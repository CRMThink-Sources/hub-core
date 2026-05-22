import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { ListContactsController } from '../presentation/controllers/list-contacts.controller'

export const makeListContactsController = async (
  request: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(request)
  return new ListContactsController(bitrix)
}
