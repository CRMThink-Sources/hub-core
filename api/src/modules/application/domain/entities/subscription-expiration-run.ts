import { Subscription } from './subscription'

/** Quem disparou a rodada: o cron horário ou um usuário do backoffice. */
export type SubscriptionExpirationTrigger = 'scheduled' | 'manual'

/**
 * `running` órfão — processo morto no meio — continua `running` para sempre: quem
 * morreu não grava nada. "Abandonada" é derivado na leitura, pela idade.
 */
export type SubscriptionExpirationRunStatus = 'running' | 'success' | 'failed'

/** Uma assinatura que a rodada alterou, ou tentou alterar e falhou. */
export interface SubscriptionExpirationChange {
  subscriptionId: string
  from: Subscription['status']
  to: Extract<Subscription['status'], 'trial_expired' | 'past_due'>
  periodEnd: Date
  succeeded: boolean
  error?: string
}

/** O que a varredura apurou: contadores e o detalhe do que mudou ou falhou. */
export interface SubscriptionExpirationResult {
  checked: number
  trialExpired: number
  pastDue: number
  failed: number
  /** A rodada parou no meio porque o Bitrix pausou o método. */
  paused: boolean
  changes: SubscriptionExpirationChange[]
}

export interface SubscriptionExpirationRun {
  id: string
  trigger: SubscriptionExpirationTrigger
  /** `null` na rodada agendada, ou quando o usuário foi apagado. */
  triggeredBy: { id: string; name: string } | null
  status: SubscriptionExpirationRunStatus
  startedAt: Date
  finishedAt: Date | null
  checked: number
  trialExpired: number
  pastDue: number
  failed: number
  paused: boolean
  error: string | null
}

export interface SubscriptionExpirationRunDetail extends SubscriptionExpirationRun {
  changes: SubscriptionExpirationChange[]
}
