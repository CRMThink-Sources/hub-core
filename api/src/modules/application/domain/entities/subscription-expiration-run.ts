import { Subscription } from './subscription'

/** Quem disparou a rodada: o cron horário ou um usuário do backoffice. */
export type SubscriptionExpirationTrigger = 'scheduled' | 'manual'

/**
 * `running` órfão — processo morto no meio — continua `running` para sempre: quem
 * morreu não grava nada. "Abandonada" é derivado na leitura, pela idade.
 */
export type SubscriptionExpirationRunStatus = 'running' | 'success' | 'failed'

/**
 * - `status`: mudança de status da assinatura na SPA 1142.
 * - `line-unsubscribed`: linha desassinada no provider no 5º dia de vencimento.
 * - `line-subscribed`: linha que a reconciliação encontrou sem assinatura e assinou.
 */
export type SubscriptionExpirationChangeKind =
  | 'status'
  | 'line-unsubscribed'
  | 'line-subscribed'

/** Uma ação que a rodada fez, ou tentou fazer e falhou. */
export interface SubscriptionExpirationChange {
  kind: SubscriptionExpirationChangeKind
  subscriptionId: string
  /** Só em `status`. */
  from: Subscription['status'] | null
  /** Só em `status`. */
  to: Extract<
    Subscription['status'],
    'trial_expired' | 'past_due' | 'cancelled'
  > | null
  /** Item da SPA 1146, nas ações de linha. */
  itemId?: string
  provider?: 'ZAPI' | 'HUBMESSAGE'
  /** Fim do período da assinatura; `null` quando a ação não o leu (reconciliação). */
  periodEnd: Date | null
  succeeded: boolean
  error?: string
}

export interface SubscriptionExpirationCounters {
  checked: number
  trialExpired: number
  pastDue: number
  /** Linhas desassinadas no 5º dia de vencimento. */
  linesUnsubscribed: number
  /** Assinaturas manuais canceladas no 10º dia de vencimento. */
  cancelled: number
  /** Linhas verificadas pela reconciliação. */
  linesChecked: number
  /** Linhas que a reconciliação encontrou sem assinatura e assinou. */
  linesSubscribed: number
  failed: number
  /** A rodada incluiu a reconciliação diária. */
  reconciliation: boolean
  /** As etapas de provider foram puladas: efeitos de provider desligados no ambiente. */
  providerStepsSkipped: boolean
  /** A rodada parou no meio porque o Bitrix pausou o método. */
  paused: boolean
}

/** O que a verificação apurou: contadores e o detalhe do que mudou ou falhou. */
export interface SubscriptionExpirationResult extends SubscriptionExpirationCounters {
  changes: SubscriptionExpirationChange[]
}

export interface SubscriptionExpirationRun extends SubscriptionExpirationCounters {
  id: string
  trigger: SubscriptionExpirationTrigger
  /** `null` na rodada agendada, ou quando o usuário foi apagado. */
  triggeredBy: { id: string; name: string } | null
  status: SubscriptionExpirationRunStatus
  startedAt: Date
  finishedAt: Date | null
  error: string | null
}

export interface SubscriptionExpirationRunDetail extends SubscriptionExpirationRun {
  changes: SubscriptionExpirationChange[]
}
