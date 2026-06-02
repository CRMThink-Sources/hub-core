import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { GoogleOAuthClient } from '../infra/clients/google-oauth.client'
import { GoogleSheetsClient } from '../infra/clients/google-sheets.client'
import { googleOAuthStateStore } from '../infra/google-oauth-state.store'
import { PrismaImportSheetAuthTokenRepository } from '../infra/persistence/repositories/prisma-importsheet-auth-token.repository'
import { GoogleConnectionService } from '../application/google-connection.service'
import { GetSpreadsheetService } from '../application/get-spreadsheet.service'
import { GoogleOAuthUrlController } from '../presentation/controllers/google-oauth-url.controller'
import { GoogleOAuthCallbackController } from '../presentation/controllers/google-oauth-callback.controller'
import { GoogleDisconnectController } from '../presentation/controllers/google-disconnect.controller'
import { GetSpreadsheetController } from '../presentation/controllers/get-spreadsheet.controller'

const makeService = (): GoogleConnectionService =>
  new GoogleConnectionService(
    new GoogleOAuthClient(),
    new PrismaImportSheetAuthTokenRepository(),
  )

export const makeGoogleOAuthUrlController = (_req: Request): Controller =>
  new GoogleOAuthUrlController(new GoogleOAuthClient(), googleOAuthStateStore)

export const makeGoogleOAuthCallbackController = (_req: Request): Controller =>
  new GoogleOAuthCallbackController(
    googleOAuthStateStore,
    new PrismaInstalledAppRepository(),
    makeService(),
  )

export const makeGoogleDisconnectController = (_req: Request): Controller =>
  new GoogleDisconnectController(
    new PrismaInstalledAppRepository(),
    makeService(),
  )

export const makeGetSpreadsheetController = (_req: Request): Controller =>
  new GetSpreadsheetController(
    new PrismaInstalledAppRepository(),
    new GetSpreadsheetService(makeService(), new GoogleSheetsClient()),
  )
