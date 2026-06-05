import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { GoogleOAuthClient } from '../infra/clients/google-oauth.client'
import { GoogleSheetsClient } from '../infra/clients/google-sheets.client'
import { PrismaImportSheetAuthTokenRepository } from '../infra/persistence/repositories/prisma-importsheet-auth-token.repository'
import { PrismaImportSheetImportRepository } from '../infra/persistence/repositories/prisma-importsheet-import.repository'
import { GoogleConnectionService } from '../application/google-connection.service'
import { GetSheetHeaderService } from '../application/get-sheet-header.service'
import { BitrixCrmMetaService } from '../application/bitrix-crm-meta.service'
import { CreateImportService } from '../application/create-import.service'
import { GetSheetHeaderController } from '../presentation/controllers/get-sheet-header.controller'
import { ListBitrixEntitiesController } from '../presentation/controllers/list-bitrix-entities.controller'
import { ListBitrixCategoriesController } from '../presentation/controllers/list-bitrix-categories.controller'
import { ListBitrixFieldsController } from '../presentation/controllers/list-bitrix-fields.controller'
import { CreateImportController } from '../presentation/controllers/create-import.controller'

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

export const makeCreateImportController = (_req: Request): Controller =>
  new CreateImportController(
    new PrismaInstalledAppRepository(),
    new CreateImportService(new PrismaImportSheetImportRepository()),
  )
