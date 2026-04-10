import { ListExpiredCredentialsRepository } from '../domain/repositories/credential/list-expired-credentials'
import { UpdateCredentialRepository } from '../domain/repositories/credential/update-credential'
import { RefreshTokenGateway } from '../domain/gateways/refresh-token.gateway'

const BUFFER_MS = 5 * 60 * 1000

export class RefreshExpiredCredentials {
  constructor(
    private readonly listExpiredRepo: ListExpiredCredentialsRepository,
    private readonly refreshGateway: RefreshTokenGateway,
    private readonly updateRepo: UpdateCredentialRepository,
  ) {}

  async execute(): Promise<void> {
    const buffer = new Date(Date.now() + BUFFER_MS)
    const expiredCredentials = await this.listExpiredRepo.listExpired(buffer)
    if (expiredCredentials.length === 0) return

    console.log(
      `[RefreshExpiredCredentials] Found ${expiredCredentials.length} credential(s) to refresh`,
    )

    for (const credential of expiredCredentials) {
      try {
        const result = await this.refreshGateway.refresh({
          clientId: credential.clientId,
          clientSecret: credential.clientSecret,
          refreshToken: credential.refreshToken,
        })

        await this.updateRepo.update({
          appId: credential.appId,
          clientId: credential.clientId,
          clientSecret: credential.clientSecret,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        })

        console.log(
          `[RefreshExpiredCredentials] Refreshed credential for app ${credential.appId}`,
        )
      } catch (error) {
        console.error(
          `[RefreshExpiredCredentials] Failed to refresh credential ${credential.id}:`,
          error,
        )
      }
    }
  }
}
