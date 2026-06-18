import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixUserService } from '@/shared/application/bitrix-user.service'
import { ClickSignBitrixFieldsService } from '../application/bitrix-fields.service'
import { ListFieldsController } from '../presentation/controllers/list-fields.controller'
import { ListUsersController } from '../presentation/controllers/list-users.controller'

export const makeListFieldsController = async (
  req: Request,
): Promise<Controller> =>
  new ListFieldsController(
    new ClickSignBitrixFieldsService(await makeBitrixClient(req)),
  )

export const makeListUsersController = async (
  req: Request,
): Promise<Controller> =>
  new ListUsersController(new BitrixUserService(await makeBitrixClient(req)))
