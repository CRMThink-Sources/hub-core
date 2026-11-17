import type {
  SubscriptionLineBilling,
  SubscriptionLineBillingResult,
} from '@/modules/application/domain/repositories/subscription-line-billing'
import type { ActiveSubscriptionItemLister } from '@/modules/thinkzap/domain/ports/active-subscription-item-lister.port'
import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'
import type { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { apiLogger } from '@/shared/infra/logger'
import type { SyncSpaItemResourceStatus } from './sync-spa-item-resource-status'

export const RECONCILE_UNSUBSCRIBE_LIMIT = 50
export const RECONCILE_UNSUBSCRIBE_FAILURE_LIMIT = 20
/**
 * Zero = só lista as candidatas no log. Reprovisionar sem guarda de órfão (recurso criado
 * e credencial não gravada) criaria uma instância paga nova a cada rodada.
 */
export const RECONCILE_PROVISION_LIMIT = 0

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
    private readonly mirrors: Pick<SpaItemResourceMirrorRepository, 'find'>,
    /**
     * Pede o provisionamento de um item ativo que declara provider e não tem
     * credencial — o ADD dele se perdeu ou o provisionamento falhou. Pela fila, para
     * nunca rodar em paralelo com um provisionamento em andamento do mesmo item.
     */
    private readonly requestProvisioning: (itemId: string) => Promise<unknown>,
    /**
     * Teto de chamadas ao provider por rodada. A primeira rodada encontra todo o
     * histórico de linhas canceladas sem marca; o teto espalha isso em dias, e um
     * erro de dado aparece no histórico antes de virar cancelamento em massa.
     */
    private readonly unsubscribeLimitPerRun: number = RECONCILE_UNSUBSCRIBE_LIMIT,
    /** Cada provisionamento cria um recurso pago; o teto limita o estrago de um dado errado. */
    private readonly provisionLimitPerRun: number = RECONCILE_PROVISION_LIMIT,
  ) {}

  async reconcileCancelledLines(cancelledSubscriptionIds: string[]) {
    const cancelled = new Set(cancelledSubscriptionIds)
    const candidates = rotateDaily(
      (await this.activeItems.listItemsWithCredential()).filter(
        line =>
          line.subscriptionId !== null &&
          (line.status === 'cancelled' || cancelled.has(line.subscriptionId)),
      ),
    )

    const results: SubscriptionLineBillingResult[] = []
    let checked = 0
    let attempted = 0
    let failed = 0
    let deferred = 0

    for (const line of candidates) {
      const subscriptionId = line.subscriptionId as string

      // A marca no espelho evita reler no Bitrix, todo dia, cada linha já desassinada.
      const mirror = await this.mirrors.find(line.itemId)
      if (mirror?.unsubscribedAt !== undefined) continue

      if (
        attempted >= this.unsubscribeLimitPerRun ||
        failed >= RECONCILE_UNSUBSCRIBE_FAILURE_LIMIT
      ) {
        deferred++
        continue
      }

      checked++
      try {
        const { outcome, provider } = await this.syncItem.execute({
          itemId: line.itemId,
          traceKey: `reconcile-unsubscribe-${subscriptionId}-${line.itemId}`,
          parentStatus: cancelled.has(subscriptionId) ? 'cancelled' : null,
          mode: 'reconcile',
        })
        if (outcome === 'unsubscribed') {
          attempted++
          results.push({
            itemId: line.itemId,
            subscriptionId,
            provider: provider ?? null,
            action: 'unsubscribed',
            succeeded: true,
          })
        }
      } catch (error) {
        if (error instanceof BitrixMethodPausedError) throw error
        // Falha não consome o teto de desassinaturas: um recurso que o provider recusa
        // todo dia não pode impedir as outras linhas de serem desligadas.
        failed++
        results.push({
          itemId: line.itemId,
          subscriptionId,
          provider: null,
          action: 'unsubscribed',
          succeeded: false,
          error: messageOf(error),
        })
      }
    }

    if (deferred > 0) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          deferred,
          failed,
          limit: this.unsubscribeLimitPerRun,
        },
        'Teto de desassinaturas da reconciliação atingido — as linhas restantes ficam para a próxima rodada',
      )
    }

    return { checked, results }
  }

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
    const provisioningRequested: string[] = []
    const provisioningCandidates: string[] = []
    let provisioningDeferred = 0

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
        if (outcome === 'no-credential' && provider) {
          if (this.provisionLimitPerRun === 0) {
            provisioningCandidates.push(line.itemId)
          } else if (
            provisioningRequested.length >= this.provisionLimitPerRun
          ) {
            provisioningDeferred++
          } else {
            try {
              await this.requestProvisioning(line.itemId)
              provisioningRequested.push(line.itemId)
            } catch (error) {
              apiLogger.error(
                { app: 'thinkzap', itemId: line.itemId, err: error },
                'Não foi possível reenviar a linha sem credencial ao provisionamento',
              )
            }
          }
        }
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

    if (provisioningCandidates.length > 0) {
      apiLogger.warn(
        { app: 'thinkzap', itemIds: provisioningCandidates },
        'Linhas ativas sem credencial em assinatura ativa — reprovisionamento automático desligado, revisar manualmente',
      )
    }

    if (provisioningRequested.length > 0 || provisioningDeferred > 0) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          itemIds: provisioningRequested,
          deferred: provisioningDeferred,
        },
        'Linhas ativas sem credencial reenviadas ao provisionamento pela reconciliação',
      )
    }

    return { checked, results }
  }
}

/**
 * Começa a lista num ponto que muda a cada dia: sem estado guardado, linhas que falham
 * sempre não ficam eternamente na frente das outras quando o teto é atingido.
 */
const rotateDaily = <T>(items: T[]): T[] => {
  if (items.length === 0) return items
  const offset = Math.floor(Date.now() / 86_400_000) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
