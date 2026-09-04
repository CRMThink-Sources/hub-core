import { ListExpiredCredentialsRepository } from '../domain/repositories/credential/list-expired-credentials'
import { UpdateCredentialRepository } from '../domain/repositories/credential/update-credential'
import { RecordCredentialRefreshFailureRepository } from '../domain/repositories/credential/record-refresh-failure'
import { RefreshTokenGateway } from '../domain/gateways/refresh-token.gateway'
import { errorLogFields } from '../infra/log-error'
import { apiLogger } from '../infra/logger'

const BUFFER_MS = 5 * 60 * 1000

/**
 * Falhas consecutivas antes de a credencial parar de ser buscada por este job.
 *
 * Não é env var: não há precedente de retry configurável por env no resto do
 * código (os `attempts` de fila BullMQ são literais no `queue.add`), e uma
 * constante já é uma linha pra mudar se o ritmo se mostrar errado em produção.
 */
const MAX_REFRESH_ATTEMPTS = 5

export class RefreshExpiredCredentials {
  constructor(
    private readonly listExpiredRepo: ListExpiredCredentialsRepository,
    private readonly refreshGateway: RefreshTokenGateway,
    private readonly updateRepo: UpdateCredentialRepository,
    private readonly recordFailureRepo: RecordCredentialRefreshFailureRepository,
  ) {}

  async execute(): Promise<void> {
    const buffer = new Date(Date.now() + BUFFER_MS)
    const expiredCredentials = await this.listExpiredRepo.listExpired(
      buffer,
      MAX_REFRESH_ATTEMPTS,
    )
    if (expiredCredentials.length === 0) return

    console.log(
      `[RefreshExpiredCredentials] Found ${expiredCredentials.length} credential(s) to refresh`,
    )

    for (const credential of expiredCredentials) {
      if (credential.id) {
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

          const { attempts } = await this.recordFailureRepo.recordFailure(
            credential.appId,
          )

          /**
           * Loga só na transição pra esgotado — falha antes disso já saiu acima
           * (`console.error`), e depois disso a credencial some do `listExpired`
           * e nunca mais passa por aqui, então não há "repetir o log a cada tick".
           */
          if (attempts >= MAX_REFRESH_ATTEMPTS) {
            apiLogger.error(
              errorLogFields(
                {
                  errorCode: 'credential.refresh_exhausted',
                  category: 'integration',
                  remediation:
                    'Reautorizar/reinstalar o app no Bitrix para gerar um refresh_token novo.',
                  retriable: false,
                },
                { appId: credential.appId, attempts, err: error },
              ),
              'Credencial esgotou as tentativas de refresh — não será mais renovada automaticamente',
            )
          }
        }
      }
    }
  }
}
