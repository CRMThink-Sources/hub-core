import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { GoogleConnectionService } from '../application/google-connection.service'
import { ListImportsService } from '../application/list-imports.service'
import { IMPORTSHEET_APP_CODE_ID } from '../importsheet.constants'
import { GoogleOAuthClient } from './clients/google-oauth.client'
import { PrismaImportSheetAuthTokenRepository } from './persistence/repositories/prisma-importsheet-auth-token.repository'
import { PrismaImportSheetImportRepository } from './persistence/repositories/prisma-importsheet-import.repository'

export class ImportSheetSessionHandler implements SessionHandler {
  appCode = IMPORTSHEET_APP_CODE_ID

  handlers: SessionHanderPerformer[] = [
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const service = new GoogleConnectionService(
          new GoogleOAuthClient(),
          new PrismaImportSheetAuthTokenRepository(),
        )
        const connection = await service.getConnection(params.appId)
        return { key: 'googleConnection', data: connection } as T
      },
    },
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const service = new ListImportsService(
          new PrismaImportSheetImportRepository(),
        )
        const imports = await service.execute(params.appId)
        return { key: 'imports', data: imports } as T
      },
    },
  ]
}
