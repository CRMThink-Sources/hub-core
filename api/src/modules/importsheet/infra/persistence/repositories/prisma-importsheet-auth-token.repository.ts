import { prisma } from '@/config/prisma.js'
import { ImportSheetAuthToken } from '@/modules/importsheet/domain/entities/google-connection'
import {
  ImportSheetAuthTokenRepository,
  SaveImportSheetAuthTokenParams,
} from '@/modules/importsheet/domain/repositories/importsheet-auth-token.repository'
import {
  decryptToken,
  decryptTokenNullable,
  encryptToken,
  encryptTokenNullable,
} from '@/shared/infra/crypto/token-cipher'

type PrismaAuthTokenRow = {
  refreshToken: string
  accessToken: string | null
} & Omit<ImportSheetAuthToken, 'refreshToken' | 'accessToken'>

function toDomain(row: PrismaAuthTokenRow): ImportSheetAuthToken {
  return {
    ...row,
    refreshToken: decryptToken(row.refreshToken),
    accessToken: decryptTokenNullable(row.accessToken),
  }
}

export class PrismaImportSheetAuthTokenRepository implements ImportSheetAuthTokenRepository {
  async save(
    params: SaveImportSheetAuthTokenParams,
  ): Promise<ImportSheetAuthToken> {
    const refreshToken = encryptToken(params.refreshToken)
    const accessToken = encryptTokenNullable(params.accessToken)
    const record = await prisma.importSheetAuthToken.upsert({
      where: { appId: params.appId },
      create: {
        appId: params.appId,
        provider: params.provider,
        googleSub: params.googleSub,
        email: params.email,
        scope: params.scope,
        refreshToken,
        accessToken,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
      },
      update: {
        provider: params.provider,
        googleSub: params.googleSub,
        email: params.email,
        scope: params.scope,
        refreshToken,
        accessToken,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
      },
    })
    return toDomain(record)
  }

  async findByAppId(appId: string): Promise<ImportSheetAuthToken | null> {
    const record = await prisma.importSheetAuthToken.findUnique({
      where: { appId },
    })
    return record ? toDomain(record) : null
  }

  async deleteByAppId(appId: string): Promise<void> {
    await prisma.importSheetAuthToken.deleteMany({ where: { appId } })
  }
}
