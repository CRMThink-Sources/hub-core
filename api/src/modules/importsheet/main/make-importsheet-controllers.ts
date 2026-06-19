import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import {
  makeBitrixClient,
  makeBitrixClientByAppId,
} from '@/shared/main/make-bitrix-client'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { GoogleOAuthClient } from '../infra/clients/google-oauth.client'
import { GoogleSheetsClient } from '../infra/clients/google-sheets.client'
import { PrismaImportSheetAuthTokenRepository } from '../infra/persistence/repositories/prisma-importsheet-auth-token.repository'
import { PrismaImportSheetImportRepository } from '../infra/persistence/repositories/prisma-importsheet-import.repository'
import { GoogleConnectionService } from '../application/google-connection.service'
import { GetSheetHeaderService } from '../application/get-sheet-header.service'
import { BitrixCrmMetaService } from '../application/bitrix-crm-meta.service'
import { CreateImportService } from '../application/create-import.service'
import { UpdateImportService } from '../application/update-import.service'
import { ListImportsService } from '../application/list-imports.service'
import { RunImportService } from '../application/run-import.service'
import { GetSheetHeaderController } from '../presentation/controllers/get-sheet-header.controller'
import { ListBitrixEntitiesController } from '../presentation/controllers/list-bitrix-entities.controller'
import { ListBitrixCategoriesController } from '../presentation/controllers/list-bitrix-categories.controller'
import { ListBitrixFieldsController } from '../presentation/controllers/list-bitrix-fields.controller'
import { CreateImportController } from '../presentation/controllers/create-import.controller'
import { ListImportsController } from '../presentation/controllers/list-imports.controller'
import { GetImportController } from '../presentation/controllers/get-import.controller'
import { UpdateImportController } from '../presentation/controllers/update-import.controller'
import { DeleteImportController } from '../presentation/controllers/delete-import.controller'
import { RunImportController } from '../presentation/controllers/run-import.controller'
import { SetImportEnabledController } from '../presentation/controllers/set-import-enabled.controller'
import { GetImportErrorsController } from '../presentation/controllers/get-import-errors.controller'
import { ReprocessImportController } from '../presentation/controllers/reprocess-import.controller'
import { ListBitrixUsersController } from '../presentation/controllers/list-bitrix-users.controller'
import { GetNotifySettingsController } from '../presentation/controllers/get-notify-settings.controller'
import { UpdateNotifySettingsController } from '../presentation/controllers/update-notify-settings.controller'
import { BitrixUserService } from '@/shared/application/bitrix-user.service'

const makeConnectionService = (): GoogleConnectionService =>
  new GoogleConnectionService(
    new GoogleOAuthClient(),
    new PrismaImportSheetAuthTokenRepository(),
  )

export const makeGetSheetHeaderController = (_req: Request): Controller =>
  new GetSheetHeaderController(
    new PrismaInstalledAppRepository(),
    new GetSheetHeaderService(
      makeConnectionService(),
      new GoogleSheetsClient(),
    ),
  )

const makeMetaService = async (req: Request): Promise<BitrixCrmMetaService> => {
  const bitrix = await makeBitrixClient(req)
  return new BitrixCrmMetaService(bitrix)
}

export const makeListBitrixEntitiesController = async (
  req: Request,
): Promise<Controller> =>
  new ListBitrixEntitiesController(await makeMetaService(req))

export const makeListBitrixCategoriesController = async (
  req: Request,
): Promise<Controller> =>
  new ListBitrixCategoriesController(await makeMetaService(req))

export const makeListBitrixFieldsController = async (
  req: Request,
): Promise<Controller> =>
  new ListBitrixFieldsController(await makeMetaService(req))

export const makeListBitrixUsersController = async (
  req: Request,
): Promise<Controller> =>
  new ListBitrixUsersController(
    new BitrixUserService(await makeBitrixClient(req)),
  )

export const makeGetNotifySettingsController = async (
  req: Request,
): Promise<Controller> =>
  new GetNotifySettingsController(
    new PrismaInstalledAppRepository(),
    await makeBitrixClient(req),
  )

export const makeUpdateNotifySettingsController = async (
  req: Request,
): Promise<Controller> =>
  new UpdateNotifySettingsController(
    new PrismaInstalledAppRepository(),
    await makeBitrixClient(req),
  )

export const makeCreateImportController = (_req: Request): Controller =>
  new CreateImportController(
    new PrismaInstalledAppRepository(),
    new CreateImportService(new PrismaImportSheetImportRepository()),
  )

export const makeListImportsController = (_req: Request): Controller =>
  new ListImportsController(
    new PrismaInstalledAppRepository(),
    new ListImportsService(new PrismaImportSheetImportRepository()),
  )

export const makeGetImportController = (_req: Request): Controller =>
  new GetImportController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
  )

export const makeUpdateImportController = (_req: Request): Controller =>
  new UpdateImportController(
    new PrismaInstalledAppRepository(),
    new UpdateImportService(new PrismaImportSheetImportRepository()),
  )

export const makeDeleteImportController = (_req: Request): Controller =>
  new DeleteImportController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
  )

export const makeRunImportController = (_req: Request): Controller =>
  new RunImportController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
  )

export const makeSetImportEnabledController = (_req: Request): Controller =>
  new SetImportEnabledController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
  )

export const makeGetImportErrorsController = (_req: Request): Controller =>
  new GetImportErrorsController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
  )

export const makeReprocessImportController = (_req: Request): Controller =>
  new ReprocessImportController(
    new PrismaInstalledAppRepository(),
    new PrismaImportSheetImportRepository(),
    new RunImportService(
      new PrismaImportSheetImportRepository(),
      makeConnectionService(),
      new GoogleSheetsClient(),
      async (appId: string) =>
        (await makeBitrixClientByAppId(appId)) as BitrixClient,
    ),
  )
