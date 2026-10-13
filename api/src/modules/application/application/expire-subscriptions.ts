import { ExpiringSubscriptionLister } from '@/modules/application/domain/repositories/expiring-subscription.lister'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { resolveExpiredSubscriptionStatus } from '@/modules/application/domain/subscription-expiration'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { apiLogger } from '@/shared/infra/logger'

export type ExpireSubscriptionsSummary = {
  checked: number
  trialExpired: number
  pastDue: number
  failed: number
  /** A rodada parou no meio porque o Bitrix pausou o método. */
  paused: boolean
}

/**
 * Grava na SPA 1142 o status das assinaturas cujo período terminou: trial vira
 * `trial_expired`, manual vira `past_due` depois da carência.
 *
 * Uma por vez, em sequência: o volume por rodada é pequeno, e paralelizar só
 * aproximaria o limite de requisições do portal. Cada assinatura tem o seu
 * `try/catch` — a falha em uma não segura as outras, e a rodada seguinte a encontra
 * de novo, porque o status dela não mudou. Esse é o retry.
 *
 * A gravação é só `{ status }`. Ela dispara o `UPDATE` da SPA 1142, e o webhook
 * segue o ciclo de provider que já existe — que não desassina `past_due` nem
 * `trial_expired`.
 */
export class ExpireSubscriptions {
  constructor(
    private readonly lister: ExpiringSubscriptionLister,
    private readonly subscriptions: Pick<
      SubscriptionRepository,
      'updateSubscription'
    >,
    private readonly manualGraceDays: number,
  ) {}

  async execute(now: Date = new Date()): Promise<ExpireSubscriptionsSummary> {
    const summary: ExpireSubscriptionsSummary = {
      checked: 0,
      trialExpired: 0,
      pastDue: 0,
      failed: 0,
      paused: false,
    }

    try {
      const candidates = await this.lister.listExpiring(now)

      for (const subscription of candidates) {
        summary.checked++

        const status = resolveExpiredSubscriptionStatus(
          subscription,
          now,
          this.manualGraceDays,
        )
        if (!status) continue

        try {
          await this.subscriptions.updateSubscription(subscription.id, {
            status,
          })

          if (status === 'trial_expired') summary.trialExpired++
          else summary.pastDue++

          apiLogger.info(
            {
              app: 'shared',
              subscriptionId: subscription.id,
              from: subscription.status,
              to: status,
            },
            'Status de assinatura atualizado por fim de período',
          )
        } catch (error) {
          /** A pausa vale para o portal inteiro: insistir só gasta a rodada. */
          if (error instanceof BitrixMethodPausedError) throw error

          summary.failed++
          apiLogger.error(
            {
              app: 'shared',
              subscriptionId: subscription.id,
              to: status,
              err: error,
            },
            'Falha ao gravar status de assinatura vencida — nova tentativa na próxima rodada',
          )
        }
      }
    } catch (error) {
      if (!(error instanceof BitrixMethodPausedError)) throw error

      summary.paused = true
      apiLogger.warn(
        { app: 'shared', err: error },
        'Bitrix pausou o método — varredura de expiração encerrada até a próxima rodada',
      )
    }

    apiLogger.info(
      { app: 'shared', ...summary },
      'Varredura de expiração de assinaturas concluída',
    )

    return summary
  }
}
