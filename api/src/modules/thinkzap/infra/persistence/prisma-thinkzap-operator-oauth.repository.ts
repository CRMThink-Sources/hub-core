import { prisma } from '@/config/prisma.js'
import { randomUUID } from 'crypto'

export type ThinkzapOperatorOAuthRecord = {
  id: string
  appId: string
  bitrixUserId: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export class PrismaThinkzapOperatorOAuthRepository {
  async findByAppAndUser(params: {
    appId: string
    bitrixUserId: string
  }): Promise<ThinkzapOperatorOAuthRecord | null> {
    const row = await prisma.thinkzapOperatorOAuth.findUnique({
      where: {
        appId_bitrixUserId: {
          appId: params.appId,
          bitrixUserId: params.bitrixUserId,
        },
      },
    })

    if (!row) return null

    return {
      id: row.id,
      appId: row.appId,
      bitrixUserId: row.bitrixUserId,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
    }
  }

  async upsert(params: {
    appId: string
    bitrixUserId: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }): Promise<ThinkzapOperatorOAuthRecord> {
    const row = await prisma.thinkzapOperatorOAuth.upsert({
      where: {
        appId_bitrixUserId: {
          appId: params.appId,
          bitrixUserId: params.bitrixUserId,
        },
      },
      create: {
        id: randomUUID(),
        appId: params.appId,
        bitrixUserId: params.bitrixUserId,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt,
      },
      update: {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt,
      },
    })

    return {
      id: row.id,
      appId: row.appId,
      bitrixUserId: row.bitrixUserId,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
    }
  }

  async updateTokens(params: {
    appId: string
    bitrixUserId: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }): Promise<void> {
    await prisma.thinkzapOperatorOAuth.update({
      where: {
        appId_bitrixUserId: {
          appId: params.appId,
          bitrixUserId: params.bitrixUserId,
        },
      },
      data: {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt,
      },
    })
  }
}
