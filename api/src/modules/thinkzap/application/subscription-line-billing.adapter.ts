import type {
  SubscriptionLineBilling,
  SubscriptionLineBillingResult,
} from '@/modules/application/domain/repositories/subscription-line-billing'
import type { ActiveSubscriptionItemLister } from '@/modules/thinkzap/domain/ports/active-subscription-item-lister.port'
import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import type { SyncSpaItemResourceStatus } from './sync-spa-item-resource-status'

/**
 * A cobrança das linhas pedida pela verificação de assinaturas, sobre o mesmo caso de
 * uso do UPDATE do item (`SyncSpaItemResourceStatus`) — a marca, a credencial e a
 * idempotência ficam num lugar só; aqui só muda o `mode`.
 *
 * Linha a linha, em sequência, cada uma com o próprio `try/catch`: a falha vira
 * resultado e as outras seguem. A pausa do Bitrix sobe, porque vale para todas.
 */
export class SubscriptionLineBillingAdapter implements SubscriptionLineBilling {
  constructor(
    private readonly itemIds: SubscriptionItemIdLister,
    private readonly activeItems: ActiveSubscriptionItemLister,
    private readonly syncItem: Pick<SyncSpaItemResourceStatus, 'execute'>,
  ) {}

  async unsubscribeLinesForPastDue(
    subscriptionId: string,
  ): Promise<SubscriptionLineBillingResult[]> {
    const ids = await this.itemIds.listSubscriptionItemIds(subscriptionId)
    const results: SubscriptionLineBillingResult[] = []

    for (const itemId of ids) {
      try {
        const { outcome, provider } = await this.syncItem.execute({
          itemId,
          traceKey: `past-due-${subscriptionId}-${itemId}`,
          parentStatus: 'past_due',
          mode: 'past-due-expired',
        })
        if (outcome === 'unsubscribed') {
          results.push({
            itemId,
            subscriptionId,
            provider: provider ?? null,
            action: 'unsubscribed',
            succeeded: true,
          })
        }
      } catch (error) {
        if (error instanceof BitrixMethodPausedError) throw error
        results.push({
          itemId,
          subscriptionId,
          provider: null,
          action: 'unsubscribed',
          succeeded: false,
          error: messageOf(error),
        })
      }
    }

    return results
  }

  async reconcileActiveLines(activeSubscriptionIds: string[]) {
    const active = new Set(activeSubscriptionIds)
    const lines = (await this.activeItems.listActiveItems()).filter(
      line => line.subscriptionId !== null && active.has(line.subscriptionId),
    )
    const results: SubscriptionLineBillingResult[] = []
    let checked = 0

    for (const line of lines) {
      const subscriptionId = line.subscriptionId as string
      checked++
      try {
        const { outcome, provider } = await this.syncItem.execute({
          itemId: line.itemId,
          traceKey: `reconcile-${subscriptionId}-${line.itemId}`,
          parentStatus: 'active',
          mode: 'reconcile',
        })
        if (outcome === 'subscribed') {
          results.push({
            itemId: line.itemId,
            subscriptionId,
            provider: provider ?? null,
            action: 'subscribed',
            succeeded: true,
          })
        }
      } catch (error) {
        if (error instanceof BitrixMethodPausedError) throw error
        results.push({
          itemId: line.itemId,
          subscriptionId,
          provider: null,
          action: 'subscribed',
          succeeded: false,
          error: messageOf(error),
        })
      }
    }

    return { checked, results }
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
