import type { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { ProviderResourceBilling } from './provider-resource-billing'

export type GatewayStatePatch = {
  status: Subscription['status']
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

/** Uma linha que o cancelamento tentou desassinar. */
export type GatewayStateLineResult = {
  itemId: string
  provider: 'ZAPI' | 'HUBMESSAGE' | null
  succeeded: boolean
}

/** O que foi feito numa assinatura da SPA que compartilha o id do gateway. */
export type GatewayStateSubscriptionResult = {
  subscriptionId: string
  outcome: 'unchanged' | 'updated' | 'cancelled' | 'failed'
  from: { status: Subscription['status']; currentPeriodEnd: Date }
  /** Presente em `updated` e `cancelled` (e na tentativa que falhou). */
  to?: { status: Subscription['status']; currentPeriodEnd: Date | null }
  /** Só em `cancelled`: as linhas desassinadas ou que falharam. */
  lines?: GatewayStateLineResult[]
  error?: string
}

export type GatewayStateResult = {
  /** `false`: nenhuma assinatura da SPA tem esse id do gateway. */
  known: boolean
  subscriptions: GatewayStateSubscriptionResult[]
}

/**
 * Aplica na SPA 1142 o estado de uma assinatura do gateway — o que o webhook faz com
 * `subscription.updated`/`subscription.deleted`, e o que a sincronização Stripe faz
 * com o estado lido direto do Stripe. Um código só, para os dois não divergirem.
 *
 * Mesmo `gatewayId` em várias assinaturas da SPA (uma por plano): o estado vai para
 * todas, e a falha numa não aborta as outras — abortar deixaria metade do contrato
 * com status divergente.
 */
export class ApplyGatewaySubscriptionState {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly providerBilling: ProviderResourceBilling,
  ) {}

  // Sem unsubscribe em `past_due`: recusa de cartão é transitória e desconectar exige reler o QR.
  async applyUpdate(
    gatewaySubscriptionId: string,
    patch: GatewayStatePatch,
    totalLineQuantity: number,
    source = 'subscription.updated',
  ): Promise<GatewayStateResult> {
    const subscriptions = await this.subscriptions.listSubscriptionsByGatewayId(
      gatewaySubscriptionId,
    )

    if (subscriptions.length === 0) {
      this.logUnknown(source, gatewaySubscriptionId)
      return { known: false, subscriptions: [] }
    }

    await this.reportQuantityDivergence(
      gatewaySubscriptionId,
      subscriptions.map(subscription => subscription.id),
      totalLineQuantity,
      source,
    )

    const results: GatewayStateSubscriptionResult[] = []

    for (const subscription of subscriptions) {
      const from = {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      }

      // Reentrega já aplicada não escreve: evita invalidar cache e reler o Bitrix.
      if (
        subscription.status === patch.status &&
        sameCalendarDay(subscription.currentPeriodEnd, patch.currentPeriodEnd)
      ) {
        results.push({
          subscriptionId: subscription.id,
          outcome: 'unchanged',
          from,
        })
        continue
      }

      const to = {
        status: patch.status,
        currentPeriodEnd: patch.currentPeriodEnd,
      }
      const error = await this.writeSibling(
        source,
        gatewaySubscriptionId,
        subscription.id,
        () => this.subscriptions.updateSubscription(subscription.id, patch),
      )

      results.push(
        error === null
          ? { subscriptionId: subscription.id, outcome: 'updated', from, to }
          : {
              subscriptionId: subscription.id,
              outcome: 'failed',
              from,
              to,
              error,
            },
      )
    }

    return { known: true, subscriptions: results }
  }

  // SPA primeiro (é o que bloqueia a linha); falha do unsubscribe não desfaz o cancelamento.
  async applyCancellation(
    gatewaySubscriptionId: string,
    source = 'subscription.deleted',
  ): Promise<GatewayStateResult> {
    const subscriptions = await this.subscriptions.listSubscriptionsByGatewayId(
      gatewaySubscriptionId,
    )

    if (subscriptions.length === 0) {
      this.logUnknown(source, gatewaySubscriptionId)
      return { known: false, subscriptions: [] }
    }

    const results: GatewayStateSubscriptionResult[] = []

    for (const subscription of subscriptions) {
      const from = {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      }

      if (subscription.status === 'cancelled') {
        results.push({
          subscriptionId: subscription.id,
          outcome: 'unchanged',
          from,
        })
        continue
      }

      const to = { status: 'cancelled' as const, currentPeriodEnd: null }
      const error = await this.writeSibling(
        source,
        gatewaySubscriptionId,
        subscription.id,
        () =>
          this.subscriptions.updateSubscription(subscription.id, {
            status: 'cancelled',
          }),
      )

      // Só desassina o que cancelou: senão o cliente paga por recurso que o provider corta.
      if (error !== null) {
        results.push({
          subscriptionId: subscription.id,
          outcome: 'failed',
          from,
          to,
          error,
        })
        continue
      }

      const items = await this.items.getSubscriptionItemsBySubscription(
        subscription.id,
      )

      const lines: GatewayStateLineResult[] = []
      for (const item of items) {
        const result = await this.providerBilling.unsubscribe(item)
        if (result.status === 'skipped') continue
        lines.push({
          itemId: item.id,
          provider: result.provider,
          succeeded: result.status === 'unsubscribed',
        })
      }

      results.push({
        subscriptionId: subscription.id,
        outcome: 'cancelled',
        from,
        to,
        lines,
      })
    }

    return { known: true, subscriptions: results }
  }

  // Só loga: a SPA é a fonte de verdade das linhas; quantidade do gateway não cria nem cancela.
  private async reportQuantityDivergence(
    gatewaySubscriptionId: string,
    subscriptionIds: string[],
    totalLineQuantity: number,
    source: string,
  ): Promise<void> {
    const counts = await Promise.all(
      subscriptionIds.map(async id => {
        const items = await this.items.getSubscriptionItemsBySubscription(id)
        return items.filter(item => item.status === 'active').length
      }),
    )

    const lines = counts.reduce((total, count) => total + count, 0)
    if (lines === totalLineQuantity) return

    logThinkzapError(
      apiLogger,
      'thinkzap.gateway.quantity_divergence',
      {
        app: 'thinkzap',
        event: source,
        gatewaySubscriptionId,
        subscriptionIds,
        gatewayQuantity: totalLineQuantity,
        spaLineCount: lines,
      },
      {
        msg: 'Quantidade cobrada no gateway diverge das linhas na SPA — nada foi criado nem cancelado; reconciliar à mão',
      },
    )
  }

  /** Falha não aborta as irmãs. Devolve `null` no sucesso ou a mensagem do erro. */
  private async writeSibling(
    event: string,
    gatewaySubscriptionId: string,
    subscriptionId: string,
    write: () => Promise<unknown>,
  ): Promise<string | null> {
    try {
      await write()
      return null
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.webhook_handler_failed',
        {
          app: 'thinkzap',
          event,
          gatewaySubscriptionId,
          subscriptionId,
          err: error,
        },
        {
          level: 'error',
          msg: 'Falha ao escrever o estado do gateway numa assinatura do contrato — as demais seguem',
        },
      )
      return error instanceof Error ? error.message : String(error)
    }
  }

  private logUnknown(event: string, gatewaySubscriptionId: string): void {
    apiLogger.info(
      { app: 'thinkzap', event, gatewaySubscriptionId },
      'Evento do gateway para assinatura desconhecida na SPA — ignorado; o checkout que vem depois resolve o estado',
    )
  }
}

/**
 * O fim do período na SPA é **dia de calendário** (o mapper lê `23:59:59.999Z` do dia
 * gravado), e o do gateway é o instante real da renovação. Comparar instantes nunca
 * bateria — toda reentrega e toda rodada da sincronização reescreveriam a assinatura.
 * A escrita grava o dia UTC do instante (`toSpaCalendarDateValue`), então é esse o
 * dia a comparar.
 */
function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}
