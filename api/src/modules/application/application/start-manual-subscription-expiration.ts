import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import { apiLogger } from '@/shared/infra/logger'
import { RunSubscriptionExpiration } from './run-subscription-expiration'

export type StartManualSubscriptionExpirationResult =
  | { status: 'started'; runId: string }
  /** Outra rodada está varrendo agora. */
  | { status: 'busy' }
  /** A varredura está desligada neste ambiente (homologação). */
  | { status: 'disabled' }

/**
 * "Rodar agora" do backoffice.
 *
 * Responde assim que a rodada está registrada e segura o lock; a varredura segue
 * em background e solta o lock no fim, dê certo ou não. É o mesmo lock da rodada
 * agendada, então as duas nunca varrem juntas.
 *
 * A flag é checada antes de tudo: homologação divide o portal com produção e não
 * pode gravar status nele, nem por clique.
 */
export class StartManualSubscriptionExpiration {
  constructor(
    private readonly enabled: boolean,
    private readonly lock: SubscriptionExpirationLock,
    private readonly service: Pick<
      RunSubscriptionExpiration,
      'begin' | 'complete'
    >,
  ) {}

  async execute(
    portalUserId: string,
  ): Promise<StartManualSubscriptionExpirationResult> {
    if (!this.enabled) return { status: 'disabled' }

    const token = await this.lock.tryAcquire()
    if (!token) return { status: 'busy' }

    let runId: string
    try {
      runId = await this.service.begin({ trigger: 'manual', portalUserId })
    } catch (error) {
      await this.lock.release(token)
      throw error
    }

    void this.service
      .complete(runId)
      .catch(error => {
        apiLogger.error(
          { app: 'shared', err: error, runId },
          'Rodada manual de expiração falhou',
        )
      })
      .finally(() => this.releaseQuietly(token))

    return { status: 'started', runId }
  }

  /** Falha ao soltar não pode virar rejeição sem dono: o TTL solta de qualquer forma. */
  private async releaseQuietly(token: string) {
    try {
      await this.lock.release(token)
    } catch (error) {
      apiLogger.warn(
        { app: 'shared', err: error },
        'Falha ao soltar o lock da expiração — expira pelo TTL',
      )
    }
  }
}
