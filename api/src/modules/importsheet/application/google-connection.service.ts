import { GoogleConnection } from '../domain/entities/google-connection'
import { GoogleOAuthGateway } from '../domain/gateways/google-oauth.gateway'
import { ImportSheetAuthTokenRepository } from '../domain/repositories/importsheet-auth-token.repository'

/** Margem antes da expiração pra renovar proativamente. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/** Lock global por appId — evita refresh em corrida entre requests. */
const refreshLocks = new Map<string, Promise<string>>()

export class GoogleConnectionService {
  constructor(
    private readonly gateway: GoogleOAuthGateway,
    private readonly repository: ImportSheetAuthTokenRepository,
  ) {}

  async connect(appId: string, code: string): Promise<void> {
    const tokens = await this.gateway.exchangeCode(code)
    const userInfo = await this.gateway.getUserInfo(tokens.accessToken)

    let refreshToken = tokens.refreshToken
    if (!refreshToken) {
      const existing = await this.repository.findByAppId(appId)
      refreshToken = existing?.refreshToken
    }
    if (!refreshToken) {
      throw new Error('Google did not return a refresh_token')
    }

    await this.repository.save({
      appId,
      provider: 'google',
      googleSub: userInfo.sub,
      email: userInfo.email ?? null,
      scope: tokens.scope ?? null,
      refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    })
  }

  async getConnection(appId: string): Promise<GoogleConnection> {
    const record = await this.repository.findByAppId(appId)
    return { connected: record !== null, email: record?.email ?? null }
  }

  async disconnect(appId: string): Promise<void> {
    await this.repository.deleteByAppId(appId)
  }

  async getAccessToken(appId: string, forceRefresh = false): Promise<string> {
    const record = await this.repository.findByAppId(appId)
    if (!record) {
      throw new Error('Google connection not found for this app')
    }

    const stillValid =
      !forceRefresh &&
      record.accessToken !== null &&
      record.accessTokenExpiresAt !== null &&
      record.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS

    if (stillValid) return record.accessToken as string

    const existing = refreshLocks.get(appId)
    if (existing) return existing

    const refreshPromise = (async (): Promise<string> => {
      try {
        const tokens = await this.gateway.refresh(record.refreshToken)
        await this.repository.save({
          appId,
          provider: record.provider,
          googleSub: record.googleSub,
          email: record.email,
          scope: tokens.scope ?? record.scope,
          refreshToken: tokens.refreshToken ?? record.refreshToken,
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        })
        return tokens.accessToken
      } finally {
        refreshLocks.delete(appId)
      }
    })()

    refreshLocks.set(appId, refreshPromise)
    return refreshPromise
  }
}
