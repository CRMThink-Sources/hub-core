import { Subscription } from './entities/subscription'

const DAY_MS = 24 * 60 * 60 * 1000

/** O que a varredura precisa saber de uma assinatura — nada de plano ou aplicação. */
export type ExpirableSubscription = Pick<
  Subscription,
  'id' | 'status' | 'currentPeriodEnd' | 'modality'
> & {
  /**
   * "Vencido em": o dia em que a assinatura virou `past_due`, ancorado no início do
   * dia (`00:00:00.000Z`, a mesma convenção de `currentPeriodStart`). `null` quando
   * o campo está vazio.
   */
  pastDueAt: Date | null
}

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

/** Dias, contados de "Vencido em", até desassinar as linhas e até cancelar. */
export const PAST_DUE_UNSUBSCRIBE_AFTER_DAYS = 5
export const PAST_DUE_CANCEL_AFTER_DAYS = 10

/**
 * O que fazer com uma assinatura `past_due`:
 *
 * - `stamp`: manual sem "Vencido em" — vencida à mão no CRM ou antes do campo existir.
 *   Recebe a data de hoje, e a contagem dos dias começa dali.
 * - `unsubscribe-lines`: manual vencida há 5 dias ou mais. Devolvido em toda rodada
 *   até o décimo dia: quem desassina pula as linhas que já têm a marca, e é assim que
 *   a linha que falhou é tentada de novo.
 * - `cancel`: manual vencida há 10 dias ou mais.
 * - `null`: Stripe (o status dela é do gateway), outro status, ou ainda dentro dos 5 dias.
 *
 * `today` e `pastDueAt` são comparados como dias de calendário pelo componente UTC,
 * a mesma convenção de `currentPeriodEnd`.
 */
export function resolvePastDueAction(
  subscription: Pick<
    ExpirableSubscription,
    'status' | 'modality' | 'pastDueAt'
  >,
  today: Date,
): 'stamp' | 'unsubscribe-lines' | 'cancel' | null {
  if (subscription.status !== 'past_due') return null
  if (subscription.modality !== 'manual') return null
  if (!subscription.pastDueAt) return 'stamp'

  const days = calendarDaysBetween(subscription.pastDueAt, today)
  if (days >= PAST_DUE_CANCEL_AFTER_DAYS) return 'cancel'
  if (days >= PAST_DUE_UNSUBSCRIBE_AFTER_DAYS) return 'unsubscribe-lines'
  return null
}

/** Dias inteiros de calendário de `from` até `to`, pelo componente UTC. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const startOf = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((startOf(to) - startOf(from)) / DAY_MS)
}
