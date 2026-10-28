import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type {
  SubscriptionExpirationRunStatus,
  SubscriptionExpirationTrigger,
} from '@/modules/application/domain/entities/subscription-expiration-run'

/** Gatilho e resultado são os mesmos da verificação de assinaturas. */
export type StripeSyncTrigger = SubscriptionExpirationTrigger
export type StripeSyncRunStatus = SubscriptionExpirationRunStatus

/**
 * - `updated`: status e/ou período da SPA trazidos para o do Stripe.
 * - `cancelled`: Stripe cancelada, SPA gravada como `cancelled`.
 * - `line-unsubscribed`: linha desassinada no provider pelo cancelamento.
 * - `not-found`: o Stripe não tem a assinatura; a SPA não foi tocada.
 * - `unknown-status`: status do Stripe fora do mapa; a SPA não foi tocada.
 * - `failed`: leitura no Stripe ou escrita na SPA falhou.
 */
export type StripeSyncChangeKind =
  | 'updated'
  | 'cancelled'
  | 'line-unsubscribed'
  | 'not-found'
  | 'unknown-status'
  | 'failed'

export interface StripeSyncChange {
  kind: StripeSyncChangeKind
  subscriptionId: string
  gatewayId: string
  itemId?: string
  provider?: 'ZAPI' | 'HUBMESSAGE'
  /** Em `unknown-status`, `toStatus` traz o status cru do Stripe. */
  fromStatus: Subscription['status'] | null
  toStatus: string | null
  fromPeriodEnd: Date | null
  toPeriodEnd: Date | null
  succeeded: boolean
  error?: string
}

export interface StripeSyncCounters {
  /** Ids do gateway lidos no Stripe. */
  checked: number
  /** Assinaturas puladas: de outro ambiente ou sem id do gateway. */
  skipped: number
  updated: number
  cancelled: number
  linesUnsubscribed: number
  notFound: number
  failed: number
  paused: boolean
}

export interface StripeSyncResult extends StripeSyncCounters {
  changes: StripeSyncChange[]
}

export interface StripeSyncRun extends StripeSyncCounters {
  id: string
  trigger: StripeSyncTrigger
  triggeredBy: { id: string; name: string } | null
  status: StripeSyncRunStatus
  startedAt: Date
  finishedAt: Date | null
  error: string | null
}

export interface StripeSyncRunDetail extends StripeSyncRun {
  changes: StripeSyncChange[]
}
