import type { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { GatewayEvent } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { ActivateLineSubscription } from './activate-line-subscription'
import { ProviderResourceBilling } from './provider-resource-billing'

// Mesmo `gatewayId` em várias assinaturas da SPA (uma por plano): status vai para todas.
// Evento fora de ordem é ignorado com log; lançar faria o gateway reentregar em backoff.
export class HandleGatewayWebhookEvent {
  constructor(
    private readonly activate: ActivateLineSubscription,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly providerBilling: ProviderResourceBilling,
  ) {}

  async execute(event: GatewayEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.completed':
        await this.activate.execute({
          domainId: event.installation.domainId,
          appCode: event.installation.appCode,
          planId: event.installation.planId,
          gatewaySubscriptionId: event.gatewaySubscriptionId,
          intent: event.intent,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
        })
        return

      case 'subscription.updated':
        await this.applyStatus(
          event.gatewaySubscriptionId,
          {
            status: event.status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
          },
          event.totalLineQuantity,
        )
        return

      case 'subscription.deleted':
        await this.applyCancellation(event.gatewaySubscriptionId)
        return

      case 'ignored':
        apiLogger.info(
          { app: 'thinkzap', event: event.name },
          'Evento do gateway fora dos três tratados — ignorado',
        )
        return
    }
  }

  // Sem unsubscribe em `past_due`: recusa de cartão é transitória e desconectar exige reler o QR.
  private async applyStatus(
    gatewaySubscriptionId: string,
    patch: {
      status: Subscription['status']
      currentPeriodStart: Date
      currentPeriodEnd: Date
    },
    totalLineQuantity: number,
  ): Promise<void> {
    const subscriptions = await this.subscriptions.listSubscriptionsByGatewayId(
      gatewaySubscriptionId,
    )

    if (subscriptions.length === 0) {
      this.logUnknown('subscription.updated', gatewaySubscriptionId)
      return
    }

    await this.reportQuantityDivergence(
      gatewaySubscriptionId,
      subscriptions.map(subscription => subscription.id),
      totalLineQuantity,
    )

    for (const subscription of subscriptions) {
      // Reentrega já aplicada não escreve: evita invalidar cache e reler o Bitrix.
      if (
        subscription.status === patch.status &&
        subscription.currentPeriodEnd.getTime() ===
          patch.currentPeriodEnd.getTime()
      ) {
        continue
      }

      await this.writeSibling(
        'subscription.updated',
        gatewaySubscriptionId,
        subscription.id,
        () => this.subscriptions.updateSubscription(subscription.id, patch),
      )
    }
  }

  // SPA primeiro (é o que bloqueia a linha); falha do unsubscribe não desfaz o cancelamento.
  private async applyCancellation(
    gatewaySubscriptionId: string,
  ): Promise<void> {
    const subscriptions = await this.subscriptions.listSubscriptionsByGatewayId(
      gatewaySubscriptionId,
    )

    if (subscriptions.length === 0) {
      this.logUnknown('subscription.deleted', gatewaySubscriptionId)
      return
    }

    for (const subscription of subscriptions) {
      if (subscription.status === 'cancelled') continue

      const written = await this.writeSibling(
        'subscription.deleted',
        gatewaySubscriptionId,
        subscription.id,
        () =>
          this.subscriptions.updateSubscription(subscription.id, {
            status: 'cancelled',
          }),
      )

      // Só desassina o que cancelou: senão o cliente paga por recurso que o provider corta.
      if (!written) continue

      const items = await this.items.getSubscriptionItemsBySubscription(
        subscription.id,
      )

      for (const item of items) {
        await this.providerBilling.unsubscribe(item)
      }
    }
  }

  // Só loga: a SPA é a fonte de verdade das linhas; quantidade do gateway não cria nem cancela.
  private async reportQuantityDivergence(
    gatewaySubscriptionId: string,
    subscriptionIds: string[],
    totalLineQuantity: number,
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
        event: 'subscription.updated',
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

  // Falha não aborta as irmãs: abortar deixaria metade do contrato com status divergente.
  private async writeSibling(
    event: string,
    gatewaySubscriptionId: string,
    subscriptionId: string,
    write: () => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await write()
      return true
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
      return false
    }
  }

  private logUnknown(event: string, gatewaySubscriptionId: string): void {
    apiLogger.info(
      { app: 'thinkzap', event, gatewaySubscriptionId },
      'Evento do gateway para assinatura desconhecida na SPA — ignorado; o checkout que vem depois resolve o estado',
    )
  }
}
