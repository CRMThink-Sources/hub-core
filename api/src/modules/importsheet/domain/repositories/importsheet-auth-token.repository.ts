import { ImportSheetAuthToken } from '../entities/google-connection'

export type SaveImportSheetAuthTokenParams = {
  appId: string
  provider: string
  googleSub: string | null
  email: string | null
  scope: string | null
  refreshToken: string
  accessToken: string | null
  accessTokenExpiresAt: Date | null
}

export interface ImportSheetAuthTokenRepository {
  save(params: SaveImportSheetAuthTokenParams): Promise<ImportSheetAuthToken>
  findByAppId(appId: string): Promise<ImportSheetAuthToken | null>
  deleteByAppId(appId: string): Promise<void>
}
