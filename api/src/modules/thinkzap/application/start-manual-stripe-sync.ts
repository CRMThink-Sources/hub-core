import type { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import { apiLogger } from '@/shared/infra/logger'
import type { RunStripeSync } from './run-stripe-sync'

export type StartManualStripeSyncResult =
  | { status: 'started'; runId: string }
  | { status: 'busy' }
  | { status: 'disabled' }

/**
 * "Rodar agora" da sincronização Stripe: mesma rodada, mesmo lock e mesma flag do
 * cron. Responde assim que a rodada é registrada; ela termina em segundo plano e
 * solta o lock no fim.
 */
export class StartManualStripeSync {
  constructor(
    private readonly enabled: boolean,
    private readonly lock: SubscriptionExpirationLock,
    private readonly service: Pick<RunStripeSync, 'begin' | 'complete'>,
  ) {}

  async execute(portalUserId: string): Promise<StartManualStripeSyncResult> {
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
          { app: 'thinkzap', err: error, runId },
          'Sincronização Stripe manual falhou',
        )
      })
      .finally(() => this.releaseQuietly(token))

    return { status: 'started', runId }
  }

  private async releaseQuietly(token: string) {
    try {
      await this.lock.release(token)
    } catch (error) {
      apiLogger.warn(
        { app: 'thinkzap', err: error },
        'Falha ao soltar o lock da sincronização Stripe — expira pelo TTL',
      )
    }
  }
}
