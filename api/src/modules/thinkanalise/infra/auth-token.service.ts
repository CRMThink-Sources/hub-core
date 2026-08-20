import { createHash } from 'node:crypto'
import { prisma } from '@/config/prisma'
import { BlingClient } from '@/shared/infra/clients/bling.client'
import { ContaAzulClient } from '@/shared/infra/clients/conta-azul.client'
import { apiLogger } from '@/shared/infra/logger'
import { thinkanaliseError } from '../errors/catalog'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type TokenData = {
  accessToken: string
  accountId: string | null
}

const REFRESHERS: Record<
  string,
  (refreshToken: string) => Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    accountId: string | null
  }>
> = {
  conta_azul: refreshToken => ContaAzulClient.refresh(refreshToken),
  bling: refreshToken => BlingClient.refresh(refreshToken),
}

const refreshLocks = new Map<string, Promise<TokenData>>()

export class ThinkAnaliseAuthTokenService {
  async upsert(opts: {
    appId: string
    provider: string
    bitrixSourceId?: number
    refreshToken: string
    accessToken: string
    expiresIn: number
    accountId?: string | null
  }): Promise<string> {
    const hash = hashToken(opts.refreshToken)
    const expiresAt = new Date(Date.now() + opts.expiresIn * 1000)

    // Prioridade 1: registro com o mesmo refreshToken (reautenticação idempotente)
    const byHash = await prisma.thinkAnaliseAuthToken.findUnique({
      where: { refreshTokenHash: hash },
    })

    if (byHash) {
      await prisma.thinkAnaliseAuthToken.update({
        where: { id: byHash.id },
        data: {
          appId: opts.appId,
          ...(opts.bitrixSourceId !== undefined && {
            bitrixSourceId: opts.bitrixSourceId,
          }),
          ...(opts.accountId !== undefined && { accountId: opts.accountId }),
          refreshToken: opts.refreshToken,
          refreshTokenHash: hash,
          accessToken: opts.accessToken,
          accessTokenExpiresAt: expiresAt,
        },
      })
      return byHash.tokenKey
    }

    // Prioridade 2: reconexão de um source existente (identificado pelo bitrixSourceId)
    if (opts.bitrixSourceId !== undefined) {
      const bySourceId = await prisma.thinkAnaliseAuthToken.findFirst({
        where: { bitrixSourceId: opts.bitrixSourceId },
      })

      if (bySourceId) {
        await prisma.thinkAnaliseAuthToken.update({
          where: { id: bySourceId.id },
          data: {
            ...(opts.accountId !== undefined && { accountId: opts.accountId }),
            refreshToken: opts.refreshToken,
            refreshTokenHash: hash,
            accessToken: opts.accessToken,
            accessTokenExpiresAt: expiresAt,
          },
        })
        return bySourceId.tokenKey
      }
    }

    const record = await prisma.thinkAnaliseAuthToken.create({
      data: {
        app: { connect: { id: opts.appId } },
        provider: opts.provider,
        bitrixSourceId: opts.bitrixSourceId ?? null,
        accountId: opts.accountId ?? null,
        refreshToken: opts.refreshToken,
        refreshTokenHash: hash,
        accessToken: opts.accessToken,
        accessTokenExpiresAt: expiresAt,
      },
    })
    return record.tokenKey
  }

  async deleteByBitrixSourceId(bitrixSourceId: number): Promise<void> {
    await prisma.thinkAnaliseAuthToken.deleteMany({ where: { bitrixSourceId } })
  }

  async updateBitrixSourceId(
    tokenKey: string,
    bitrixSourceId: number,
  ): Promise<void> {
    await prisma.thinkAnaliseAuthToken.update({
      where: { tokenKey },
      data: { bitrixSourceId },
    })
  }

  async getAccessToken(
    provider: string,
    tokenKey: string,
    forceRefresh = false,
  ): Promise<TokenData> {
    const record = await prisma.thinkAnaliseAuthToken.findUnique({
      where: { tokenKey },
    })

    if (!record) throw thinkanaliseError('thinkanalise.token.not_found')

    const BUFFER_MS = 5 * 60 * 1000
    if (
      !forceRefresh &&
      record.accessToken &&
      record.accessTokenExpiresAt &&
      record.accessTokenExpiresAt.getTime() - Date.now() > BUFFER_MS
    ) {
      return { accessToken: record.accessToken, accountId: record.accountId }
    }

    const refresher = REFRESHERS[provider]
    if (!refresher) throw thinkanaliseError('thinkanalise.token.no_refresher')

    const existing = refreshLocks.get(tokenKey)
    if (existing) {
      apiLogger.info(
        { app: 'thinkanalise', tokenKey },
        'Refresh em andamento, aguardando lock',
      )
      return existing
    }

    const refreshPromise = (async (): Promise<TokenData> => {
      try {
        const fresh = await prisma.thinkAnaliseAuthToken.findUnique({
          where: { tokenKey },
        })
        if (!fresh) throw thinkanaliseError('thinkanalise.token.not_found')

        let result: Awaited<ReturnType<typeof refresher>>
        try {
          result = await refresher(fresh.refreshToken)
        } catch (error) {
          throw thinkanaliseError('thinkanalise.token.refresh_failed', error)
        }

        // Salva imediatamente após receber o novo token do Conta Azul.
        // O refresh_token do Conta Azul é rotativo (uso único) — se esta gravação
        // falhar, o token antigo já foi invalidado pelo servidor e a sessão morre.
        await prisma.thinkAnaliseAuthToken.update({
          where: { id: fresh.id },
          data: {
            refreshToken: result.refreshToken,
            refreshTokenHash: hashToken(result.refreshToken),
            accessToken: result.accessToken,
            accessTokenExpiresAt: new Date(
              Date.now() + result.expiresIn * 1000,
            ),
          },
        })

        return { accessToken: result.accessToken, accountId: fresh.accountId }
      } finally {
        refreshLocks.delete(tokenKey)
      }
    })()

    refreshLocks.set(tokenKey, refreshPromise)
    return refreshPromise
  }
}

export const thinkAnaliseAuthTokenService = new ThinkAnaliseAuthTokenService()
