import {
  GoogleConnection,
  ImportSheetAuthToken,
} from '../domain/entities/google-connection'
import { GoogleOAuthGateway } from '../domain/gateways/google-oauth.gateway'
import { ImportSheetAuthTokenRepository } from '../domain/repositories/importsheet-auth-token.repository'
import { acquireLock, releaseLock } from '../infra/redis-lock'

/** Margem antes da expiração pra renovar proativamente. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/** TTL do lock de refresh — cobre a chamada ao Google + save, com folga. */
const REFRESH_LOCK_TTL_MS = 30 * 1000
/** Espera entre tentativas de reler o token renovado por outro processo. */
const REFRESH_WAIT_MS = 300
const REFRESH_MAX_ATTEMPTS = 10

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

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

    if (!forceRefresh && this.isFresh(record)) {
      return record.accessToken as string
    }

    // Lock distribuído (Redis): API e worker são processos separados, então o
    // lock in-memory não bastava. Só um processo refresca por appId por vez.
    const lockKey = `importsheet:google-refresh:${appId}`

    for (let attempt = 0; attempt < REFRESH_MAX_ATTEMPTS; attempt++) {
      const token = await acquireLock(lockKey, REFRESH_LOCK_TTL_MS)
      if (token) {
        try {
          // Relê: outro processo pode ter renovado entre a checagem e o lock.
          const current = await this.repository.findByAppId(appId)
          if (!current) {
            throw new Error('Google connection not found for this app')
          }
          if (!forceRefresh && this.isFresh(current)) {
            return current.accessToken as string
          }
          return await this.doRefresh(appId, current)
        } finally {
          await releaseLock(lockKey, token)
        }
      }

      // Outro processo está refrescando — espera e relê o token do banco.
      await sleep(REFRESH_WAIT_MS)
      const refreshed = await this.repository.findByAppId(appId)
      if (refreshed && this.isFresh(refreshed)) {
        return refreshed.accessToken as string
      }
    }

    throw new Error('Could not acquire Google refresh lock for this app')
  }

  /** Access token presente e ainda dentro da validade (com buffer). */
  private isFresh(record: ImportSheetAuthToken): boolean {
    return (
      record.accessToken !== null &&
      record.accessTokenExpiresAt !== null &&
      record.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS
    )
  }

  private async doRefresh(
    appId: string,
    record: ImportSheetAuthToken,
  ): Promise<string> {
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
  }
}
