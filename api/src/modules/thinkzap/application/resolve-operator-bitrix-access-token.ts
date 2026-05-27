import { env } from '@/config/env'
import type { RefreshTokenGateway } from '@/shared/domain/gateways/refresh-token.gateway'
import type { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import type { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import type { PrismaThinkzapOperatorOAuthRepository } from '../infra/persistence/prisma-thinkzap-operator-oauth.repository'

const BUFFER_MS = 5 * 60 * 1000

export class ResolveOperatorBitrixAccessToken {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getInstalledAppRepository: GetInstalledAppRepository,
    private readonly getCredentialRepository: GetCredentialRepository,
    private readonly operatorOAuthRepository: PrismaThinkzapOperatorOAuthRepository,
    private readonly refreshGateway: RefreshTokenGateway,
    private readonly thinkzapAppCodeId: string = 'crmthink.thinkzap',
  ) {}

  async execute(
    domainName: string,
    bitrixUserId: string,
  ): Promise<string | null> {
    const domain = await this.getDomainRepository.getDomain(domainName)
    if (!domain) return null

    const availableApp = await this.getAvailableAppRepository.getById(
      this.thinkzapAppCodeId,
    )
    if (!availableApp) return null

    const installedApp =
      await this.getInstalledAppRepository.getByAppCodeAndDomainId(
        availableApp.id,
        domain.id,
      )
    if (!installedApp) return null

    const operatorOAuth = await this.operatorOAuthRepository.findByAppAndUser({
      appId: installedApp.id,
      bitrixUserId,
    })
    if (!operatorOAuth) return null

    const buffer = new Date(Date.now() + BUFFER_MS)
    if (operatorOAuth.expiresAt > buffer) {
      return operatorOAuth.accessToken
    }

    const credential = await this.getCredentialRepository.get({
      appId: installedApp.id,
    })
    if (!credential) return null

    const refreshed = await this.refreshGateway.refresh({
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      refreshToken: operatorOAuth.refreshToken,
    })

    await this.operatorOAuthRepository.updateTokens({
      appId: installedApp.id,
      bitrixUserId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    })

    return refreshed.accessToken
  }
}
