import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixUserService } from '@/shared/application/bitrix-user.service'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { ClickSignBitrixFieldsService } from '../application/bitrix-fields.service'
import { ListFieldsController } from '../presentation/controllers/list-fields.controller'
import { ListUsersController } from '../presentation/controllers/list-users.controller'
import { GetSettingsController } from '../presentation/controllers/get-settings.controller'
import { UpdateSettingsController } from '../presentation/controllers/update-settings.controller'
import { PrismaClickSignSettingsRepository } from '../infra/persistence/repositories/prisma-clicksign-settings.repository'

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

export const makeGetSettingsController = (_req: Request): Controller =>
  new GetSettingsController(
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
  )

export const makeUpdateSettingsController = (_req: Request): Controller =>
  new UpdateSettingsController(
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
  )
