import type {
  AppSubscription,
  AppSubscriptionItem,
  SubscribeLinesResponse,
} from './portal-domains'
import { readPortalError } from './portal-domains'

/**
 * O que o backoffice oferece em cada assinatura, e por que não, quando não oferece.
 *
 * Espelha as recusas da api (`gateway-managed`, `already-active`, `already-cancelled`,
 * `provider-effects-disabled`) para a tela não oferecer um botão que só serviria para
 * receber um `409`.
 */
export type SubscriptionActionsState = {
  /** Ativar/Inativar só existem para assinatura manual. */
  manageable: boolean
  canActivate: boolean
  canDeactivate: boolean
  canSubscribeLines: boolean
  /** Motivo comum a todas as ações desabilitadas, quando há um. */
  disabledReason: 'provider-effects-disabled' | null
}

export function subscriptionActions(
  subscription: AppSubscription,
  providerEffectsEnabled: boolean,
): SubscriptionActionsState {
  const manageable = subscription.modality !== 'stripe'

  return {
    manageable,
    canActivate:
      providerEffectsEnabled && manageable && subscription.status !== 'active',
    canDeactivate:
      providerEffectsEnabled &&
      manageable &&
      subscription.status !== 'cancelled',
    canSubscribeLines: providerEffectsEnabled,
    disabledReason: providerEffectsEnabled ? null : 'provider-effects-disabled',
  }
}

/** Linha de verdade: item `NONE` é cobrança sem conector, sem nada no provider. */
export const isConnectorLine = (item: AppSubscriptionItem): boolean =>
  item.metadata.provider === 'ZAPI' || item.metadata.provider === 'HUBMESSAGE'

export type LineActionsState = {
  enabled: boolean
  disabledReason: 'provider-effects-disabled' | 'no-credential' | null
}

export function lineActions(
  item: AppSubscriptionItem,
  providerEffectsEnabled: boolean,
): LineActionsState {
  if (!providerEffectsEnabled) {
    return { enabled: false, disabledReason: 'provider-effects-disabled' }
  }
  if (!item.hasCredential) {
    return { enabled: false, disabledReason: 'no-credential' }
  }
  return { enabled: true, disabledReason: null }
}

/** Linhas que "Inativar" vai desassinar: as de verdade, com credencial. */
export const linesToUnsubscribe = (subscription: AppSubscription): number =>
  subscription.items.filter(item => isConnectorLine(item) && item.hasCredential)
    .length

/** O período terminou antes de agora: ativar exige um novo fim. */
export const periodEnded = (subscription: AppSubscription, now: Date) =>
  new Date(subscription.currentPeriodEnd).getTime() < now.getTime()

/** Amanhã em `YYYY-MM-DD` (UTC): o menor fim de período que a api aceita. */
export function minPeriodEnd(now: Date): string {
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  return tomorrow.toISOString().slice(0, 10)
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const KNOWN_REFUSALS = [
  'provider-effects-disabled',
  'gateway-managed',
  'already-active',
  'already-cancelled',
  'period-end-required',
  'period-end-invalid',
]

/** Mensagem de erro de uma ação: o motivo traduzido, ou a genérica. */
export function refusalMessage(error: unknown, t: Translate): string {
  const { reason, status } = readPortalError(error)

  if (reason && KNOWN_REFUSALS.includes(reason)) {
    return t(`subscriptions.refusal.${reason}`)
  }
  // `422` sem motivo é a credencial ausente da rota de linha.
  if (status === 422) return t('subscriptions.refusal.no-credential')

  return t('subscriptions.refusal.generic')
}

/** Resultado de "Assinar todas": falha parcial tem texto e tom próprios. */
export function subscribeLinesOutcome(
  result: SubscribeLinesResponse,
  t: Translate,
): { tone: 'success' | 'warning'; message: string } {
  return result.failed > 0
    ? {
        tone: 'warning',
        message: t('subscriptions.result.linesPartial', { ...result }),
      }
    : {
        tone: 'success',
        message: t('subscriptions.result.lines', { ...result }),
      }
}
