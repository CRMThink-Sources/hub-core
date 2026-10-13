import { Subscription } from './entities/subscription'

const DAY_MS = 24 * 60 * 60 * 1000

/** O que a varredura precisa saber de uma assinatura — nada de plano ou aplicação. */
export type ExpirableSubscription = Pick<
  Subscription,
  'id' | 'status' | 'currentPeriodEnd' | 'modality'
>

/** Os únicos status que a varredura grava. */
export type ExpiredSubscriptionStatus = Extract<
  Subscription['status'],
  'trial_expired' | 'past_due'
>

/**
 * Para qual status a assinatura deve ir porque o período terminou, ou `null` se
 * nada muda.
 *
 * O corte é o mesmo de `resolveLineEntitlement`: `>` sobre `currentPeriodEnd`, que
 * já ancora no fim do último dia (`23:59:59.999Z`). Corte diferente faria o job e a
 * leitura discordarem sobre a mesma assinatura no mesmo instante.
 *
 * - `trialing` vencido → `trial_expired`, sem carência: a leitura já o trata como
 *   expirado no primeiro tick depois da janela, e o job só alcança o CRM.
 * - `active` **manual** vencido há mais que `manualGraceDays` → `past_due`. Stripe
 *   fica de fora: o status dela é do webhook do gateway.
 * - Qualquer outro status já é terminal para esta regra.
 */
export function resolveExpiredSubscriptionStatus(
  subscription: Pick<
    ExpirableSubscription,
    'status' | 'currentPeriodEnd' | 'modality'
  >,
  now: Date,
  manualGraceDays: number,
): ExpiredSubscriptionStatus | null {
  const periodEnd = subscription.currentPeriodEnd.getTime()

  if (subscription.status === 'trialing') {
    return now.getTime() > periodEnd ? 'trial_expired' : null
  }

  if (subscription.status === 'active' && subscription.modality === 'manual') {
    return now.getTime() > periodEnd + manualGraceDays * DAY_MS
      ? 'past_due'
      : null
  }

  return null
}
