import {
  SubscriptionExpirationChange,
  SubscriptionExpirationResult,
} from '@/modules/application/domain/entities/subscription-expiration-run'
import { ExpiringSubscriptionLister } from '@/modules/application/domain/repositories/expiring-subscription.lister'
import type {
  SubscriptionLineBilling,
  SubscriptionLineBillingResult,
} from '@/modules/application/domain/repositories/subscription-line-billing'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import {
  ExpirableSubscription,
  resolveExpiredSubscriptionStatus,
  resolvePastDueAction,
} from '@/modules/application/domain/subscription-expiration'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { apiLogger } from '@/shared/infra/logger'

/** Contadores e o detalhe do que mudou ou falhou — o que o histórico grava. */
export type ExpireSubscriptionsSummary = SubscriptionExpirationResult

export type ExpireSubscriptionsOptions = {
  /** Inclui a reconciliação diária das linhas (janela das 03:00 ou "Rodar agora"). */
  reconcile?: boolean
}

/**
 * A verificação de assinaturas da SPA 1142, em etapas:
 *
 * 1. **Expirar**: trial vencido vira `trial_expired`; manual vencida depois da
 *    carência vira `past_due`, com "Vencido em" = hoje na mesma escrita.
 * 2. **Vencidas** (`past_due` manuais), conforme `resolvePastDueAction`: sem data
 *    recebe a data; no 5º dia as linhas são desassinadas no provider; no 10º a
 *    assinatura vira `cancelled` com a data de cancelamento.
 * 3. **Limpar** "Vencido em" de quem saiu de `past_due`.
 * 4. **Reconciliar** (só com `reconcile`): subscribe em toda linha ativa de assinatura
 *    `active`.
 *
 * Sem `lineBilling` (efeitos de provider desligados no ambiente), as etapas que chamam
 * o provider — a desassinatura do 5º dia e a reconciliação — são puladas, e a rodada
 * diz isso em `providerStepsSkipped`.
 *
 * Uma assinatura por vez, em sequência: o volume é pequeno, e paralelizar só
 * aproximaria o limite de requisições do portal. Cada item tem o seu `try/catch` — a
 * falha em um não segura os outros, e a rodada seguinte o encontra de novo. A pausa do
 * Bitrix vale para o portal inteiro e encerra a rodada.
 */
export class ExpireSubscriptions {
  constructor(
    private readonly lister: ExpiringSubscriptionLister,
    private readonly subscriptions: Pick<
      SubscriptionRepository,
      'updateSubscription'
    >,
    private readonly manualGraceDays: number,
    private readonly lineBilling: SubscriptionLineBilling | null = null,
  ) {}

  async execute(
    now: Date = new Date(),
    options: ExpireSubscriptionsOptions = {},
  ): Promise<ExpireSubscriptionsSummary> {
    const summary: ExpireSubscriptionsSummary = {
      checked: 0,
      trialExpired: 0,
      pastDue: 0,
      linesUnsubscribed: 0,
      cancelled: 0,
      linesChecked: 0,
      linesSubscribed: 0,
      failed: 0,
      reconciliation: false,
      providerStepsSkipped: this.lineBilling === null,
      paused: false,
      changes: [],
    }

    try {
      await this.expire(now, summary)
      await this.handlePastDue(now, summary)
      await this.clearStalePastDueDates()
      if (options.reconcile && this.lineBilling) {
        await this.reconcile(this.lineBilling, summary)
      }
    } catch (error) {
      if (!(error instanceof BitrixMethodPausedError)) throw error

      summary.paused = true
      apiLogger.warn(
        { app: 'shared', err: error },
        'Bitrix pausou o método — verificação de assinaturas encerrada até a próxima rodada',
      )
    }

    /** Só os contadores: o detalhe por item já saiu linha a linha. */
    const { changes: _changes, ...counters } = summary
    apiLogger.info(
      { app: 'shared', ...counters },
      'Verificação de assinaturas concluída',
    )

    return summary
  }

  /** Etapa 1. */
  private async expire(now: Date, summary: ExpireSubscriptionsSummary) {
    const candidates = await this.lister.listExpiring(now)

    for (const subscription of candidates) {
      summary.checked++

      const status = resolveExpiredSubscriptionStatus(
        subscription,
        now,
        this.manualGraceDays,
      )
      if (!status) continue

      const recorded = await this.writeStatus(summary, subscription, status, {
        status,
        ...(status === 'past_due' && { pastDueAt: now }),
      })
      if (!recorded) continue

      if (status === 'trial_expired') summary.trialExpired++
      else summary.pastDue++
    }
  }

  /** Etapa 2. */
  private async handlePastDue(now: Date, summary: ExpireSubscriptionsSummary) {
    const pastDue = await this.lister.listPastDue()

    for (const subscription of pastDue) {
      summary.checked++

      const action = resolvePastDueAction(subscription, now)
      if (!action) continue

      if (action === 'stamp') {
        await this.writeDate(subscription.id, { pastDueAt: now })
        continue
      }

      if (action === 'cancel') {
        const recorded = await this.writeStatus(
          summary,
          subscription,
          'cancelled',
          { status: 'cancelled', canceledAt: now },
        )
        if (recorded) summary.cancelled++
        continue
      }

      if (!this.lineBilling) continue

      const lines = await this.lineBilling.unsubscribeLinesForPastDue(
        subscription.id,
      )
      for (const line of lines) {
        this.recordLine(summary, line, 'line-unsubscribed', subscription)
        if (line.succeeded) summary.linesUnsubscribed++
      }
    }
  }

  /** Etapa 3: "Vencido em" só faz sentido enquanto a assinatura está `past_due`. */
  private async clearStalePastDueDates() {
    const dated = await this.lister.listWithPastDueAt()

    for (const subscription of dated) {
      if (subscription.status === 'past_due') continue
      await this.writeDate(subscription.id, { pastDueAt: null })
    }
  }

  /** Etapa 4. */
  private async reconcile(
    lineBilling: SubscriptionLineBilling,
    summary: ExpireSubscriptionsSummary,
  ) {
    const activeIds = await this.lister.listActiveIds()
    const { checked, results } =
      await lineBilling.reconcileActiveLines(activeIds)

    summary.reconciliation = true
    summary.linesChecked += checked
    for (const line of results) {
      this.recordLine(summary, line, 'line-subscribed', null)
      if (line.succeeded) summary.linesSubscribed++
    }
  }

  /**
   * Grava uma mudança de status e a registra. Devolve se deu certo; a falha conta em
   * `failed` e a assinatura é tentada de novo na próxima rodada.
   */
  private async writeStatus(
    summary: ExpireSubscriptionsSummary,
    subscription: ExpirableSubscription,
    to: NonNullable<SubscriptionExpirationChange['to']>,
    patch: Parameters<SubscriptionRepository['updateSubscription']>[1],
  ): Promise<boolean> {
    const change = {
      kind: 'status' as const,
      subscriptionId: subscription.id,
      from: subscription.status,
      to,
      periodEnd: subscription.currentPeriodEnd,
    }

    try {
      await this.subscriptions.updateSubscription(subscription.id, patch)
      summary.changes.push({ ...change, succeeded: true })
      apiLogger.info(
        {
          app: 'shared',
          subscriptionId: subscription.id,
          from: subscription.status,
          to,
        },
        'Status de assinatura atualizado pela verificação de assinaturas',
      )
      return true
    } catch (error) {
      if (error instanceof BitrixMethodPausedError) throw error

      summary.failed++
      summary.changes.push({
        ...change,
        succeeded: false,
        error: messageOf(error),
      })
      apiLogger.error(
        { app: 'shared', subscriptionId: subscription.id, to, err: error },
        'Falha ao gravar status de assinatura — nova tentativa na próxima rodada',
      )
      return false
    }
  }

  /**
   * Grava ou limpa só a data "Vencido em". Não gera registro (não é mudança de status)
   * nem conta falha: a próxima rodada encontra a assinatura no mesmo estado.
   */
  private async writeDate(
    subscriptionId: string,
    patch: { pastDueAt: Date | null },
  ) {
    try {
      await this.subscriptions.updateSubscription(subscriptionId, patch)
    } catch (error) {
      if (error instanceof BitrixMethodPausedError) throw error
      apiLogger.error(
        { app: 'shared', subscriptionId, err: error },
        'Falha ao gravar "Vencido em" — nova tentativa na próxima rodada',
      )
    }
  }

  private recordLine(
    summary: ExpireSubscriptionsSummary,
    line: SubscriptionLineBillingResult,
    kind: 'line-unsubscribed' | 'line-subscribed',
    subscription: ExpirableSubscription | null,
  ) {
    if (!line.succeeded) summary.failed++
    summary.changes.push({
      kind,
      subscriptionId: line.subscriptionId,
      itemId: line.itemId,
      ...(line.provider && { provider: line.provider }),
      from: null,
      to: null,
      periodEnd: subscription?.currentPeriodEnd ?? null,
      succeeded: line.succeeded,
      ...(line.error && { error: line.error }),
    })
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
