import { randomUUID } from 'node:crypto'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import {
  SubscriptionLinesBillingError,
  type SyncSubscriptionLinesBilling,
  type SyncSubscriptionLinesBillingResult,
} from '@/modules/thinkzap/application/sync-subscription-lines-billing'
import type { PortalAppReadRepository } from '../domain/repositories/portal-app-read.repository'
import { resolveOwnedSubscription } from './subscription-status-actions'

export type SubscribeSubscriptionLinesDeps = {
  apps: Pick<PortalAppReadRepository, 'findById'>
  subscriptions: Pick<SubscriptionRepository, 'getSubscription'>
  sync: Pick<SyncSubscriptionLinesBilling, 'execute'>
  providerEffectsEnabled: boolean
}

export type SubscribeSubscriptionLinesOutput =
  SyncSubscriptionLinesBillingResult & {
    /** Linhas em que nada foi feito: já concordavam, sem credencial, ou assinatura em teste. */
    ignored: number
  }

/**
 * "Assinar todas no provider": a reconciliação das linhas de uma assinatura, rodada na
 * requisição em vez de na fila.
 *
 * **Não reimplementa a regra.** É o `SyncSubscriptionLinesBilling` do UPDATE da SPA 1142,
 * com a mesma decisão, a mesma marca e a mesma idempotência — e por isso vale nos dois
 * sentidos: assinatura cancelada desassina o que falta. Vale para qualquer modalidade.
 *
 * Falha em parte das linhas **não** vira erro: na fila, lançar faz retentar; aqui quem
 * retenta é o operador, que precisa ver quantas deram certo.
 */
export async function subscribeSubscriptionLines(
  input: { appId: string; subscriptionId: string },
  deps: SubscribeSubscriptionLinesDeps,
): Promise<SubscribeSubscriptionLinesOutput> {
  const subscription = await resolveOwnedSubscription(
    input.appId,
    input.subscriptionId,
    deps,
  )

  const result = await deps.sync
    .execute({
      subscriptionId: subscription.id,
      traceKey: `backoffice-subscribe-lines-${randomUUID()}`,
    })
    .catch((error: unknown) => {
      if (error instanceof SubscriptionLinesBillingError && error.result) {
        return error.result
      }
      throw error
    })

  return {
    ...result,
    ignored: Math.max(
      0,
      result.items - result.subscribed - result.unsubscribed - result.failed,
    ),
  }
}
