import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SpaItemResourceMirror } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { isTrialStatus } from '@/modules/thinkzap/domain/connector-trial'

/**
 * - `in-sync`: item cancelado e já desassinado, ou ativo e já assinado.
 * - `parent-missing`: assinatura pai inexistente ou ilegível.
 * - `parent-trial`: pai `trialing`/`trial_expired` — trial nunca assina no provider.
 * - `parent-inactive`: pai `past_due` — não inicia cobrança nova.
 */
export type ProviderBillingNoopReason =
  | 'in-sync'
  | 'parent-missing'
  | 'parent-trial'
  | 'parent-inactive'

/**
 * - `parent-cancelled`: a assinatura pai foi cancelada — todas as linhas dela saem.
 * - `item-cancelled`: só a linha foi cancelada.
 */
export type ProviderUnsubscribeReason = 'parent-cancelled' | 'item-cancelled'

export type ProviderBillingDecision =
  | { action: 'subscribe' }
  | { action: 'unsubscribe'; reason: ProviderUnsubscribeReason }
  | { action: 'noop'; reason: ProviderBillingNoopReason }

/**
 * A regra única de cobrança do recurso de uma linha no provider, a partir do que está
 * na SPA e do que o espelho diz que já foi feito.
 *
 * ```
 * pai cancelled, sem marca de desassinado               → unsubscribe (parent-cancelled)
 * item cancelled, sem marca de desassinado              → unsubscribe (item-cancelled)
 * item active, pai active, sem marca de assinado        → subscribe
 * qualquer outro                                        → noop
 * ```
 *
 * **Pai cancelado desassina toda linha**, ativa ou cancelada, e **sem exigir a marca de
 * assinado**: linhas Stripe anteriores à marca e linhas manuais assinadas fora do produto
 * não a têm, e exigi-la as deixaria cobradas de nós para sempre. O custo é cancelar no
 * provider recurso que talvez nunca tenha sido assinado (trial cancelado), e os clients
 * tratam esse cancelamento como sucesso. Só `cancelled` desassina: `past_due` é
 * transitório.
 *
 * **Item cancelado desassina sob qualquer pai.** Linha cancelada é recurso que ninguém
 * usa, sob qualquer contrato — é o comportamento de antes desta regra.
 *
 * **Assinar exige pai `active` e não trial**, também na reassinatura. Antes, item que
 * voltava a ativo era reassinado mesmo sob contrato cancelado, e nós pagávamos pela
 * linha de quem saiu. `past_due` não assina: inadimplência é transitória e não deve
 * iniciar cobrança nova — e linha já assinada continua assinada, porque isto não é
 * `unsubscribe`.
 *
 * A comparação é contra a marca, e não contra o evento, porque o payload do UPDATE não
 * traz o valor anterior de campo nenhum.
 */
export function resolveProviderBillingAction(args: {
  itemStatus: 'active' | 'cancelled'
  /** `null` quando a assinatura pai não existe ou o item não tem pai. */
  parentStatus: Subscription['status'] | null
  mirror: Pick<SpaItemResourceMirror, 'subscribedAt' | 'unsubscribedAt'> | null
}): ProviderBillingDecision {
  const subscribed = args.mirror?.subscribedAt !== undefined
  const unsubscribed = args.mirror?.unsubscribedAt !== undefined

  if (args.parentStatus === 'cancelled') {
    return unsubscribed
      ? { action: 'noop', reason: 'in-sync' }
      : { action: 'unsubscribe', reason: 'parent-cancelled' }
  }

  if (args.itemStatus === 'cancelled') {
    return unsubscribed
      ? { action: 'noop', reason: 'in-sync' }
      : { action: 'unsubscribe', reason: 'item-cancelled' }
  }

  if (subscribed) return { action: 'noop', reason: 'in-sync' }
  if (args.parentStatus === null) {
    return { action: 'noop', reason: 'parent-missing' }
  }
  if (isTrialStatus(args.parentStatus)) {
    return { action: 'noop', reason: 'parent-trial' }
  }
  if (args.parentStatus !== 'active') {
    return { action: 'noop', reason: 'parent-inactive' }
  }

  return { action: 'subscribe' }
}
