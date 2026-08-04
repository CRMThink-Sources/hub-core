import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { GatewayEvent } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { ActivateLineSubscription } from './activate-line-subscription'
import { ProviderResourceBilling } from './provider-resource-billing'

/**
 * Aplica um evento **já validado e normalizado** do gateway na SPA.
 *
 * O gateway sabe o estado real do pagamento; a SPA sabe o que o runtime obedece.
 * Este caso de uso é a única ponte entre os dois, e ele escreve só numa direção:
 * gateway → SPA. Nenhum caminho de leitura volta pelo gateway.
 *
 * Três eventos, e só três (decisão 5 do design):
 *
 * | evento | o que escreve |
 * |---|---|
 * | `checkout.completed` | a ativação em três passos, mais `subscribe` no provider |
 * | `subscription.updated` | `status` e período — é o que reflete recusa e recuperação |
 * | `subscription.deleted` | `status: 'cancelled'`, mais `unsubscribe` no provider |
 *
 * **Evento fora de ordem é ignorado com log, não erro.** Um `updated` que chega
 * antes do `checkout.completed` não encontra assinatura com aquele `gatewayId`;
 * falhar faria o gateway reentregar em backoff até desistir, e o `completed` que
 * vem depois resolve o estado de qualquer forma.
 */
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
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
        })
        return

      case 'subscription.updated':
        await this.applyStatus(event.gatewaySubscriptionId, {
          status: event.status,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
        })
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

  /**
   * Grava status e período.
   *
   * **Nenhuma operação de provider acontece aqui**, e isso inclui `past_due`:
   * inadimplência é falha transitória de cartão. Desassinar e reassinar a cada
   * recusa churna a cobrança do provider, e desconectar obrigaria o cliente a ler o
   * QR de novo por um pagamento que se resolve em dias. O bloqueio no app já basta,
   * e a recuperação religa sozinha — sem `subscribe` de novo, porque nunca
   * desassinou.
   */
  private async applyStatus(
    gatewaySubscriptionId: string,
    patch: {
      status: 'active' | 'past_due' | 'cancelled' | 'trialing'
      currentPeriodStart: Date
      currentPeriodEnd: Date
    },
  ): Promise<void> {
    const subscription = await this.subscriptions.getSubscriptionByGatewayId(
      gatewaySubscriptionId,
    )

    if (!subscription) {
      this.logUnknown('subscription.updated', gatewaySubscriptionId)
      return
    }

    /**
     * Idempotente por comparação de estado: reentrega do mesmo evento encontra a
     * assinatura já no estado final e não escreve — o que evita invalidar o cache e
     * refazer a leitura do Bitrix por nada.
     */
    if (
      subscription.status === patch.status &&
      subscription.currentPeriodEnd.getTime() ===
        patch.currentPeriodEnd.getTime()
    ) {
      return
    }

    await this.subscriptions.updateSubscription(subscription.id, patch)
  }

  /**
   * Cancela na SPA e **desassina** o recurso no provider.
   *
   * A ordem importa: a SPA primeiro, porque é o que bloqueia a linha. Falha do
   * `unsubscribe` não desfaz o cancelamento — a linha continua bloqueada, e o
   * problema que sobra é nossa cobrança com o provider, registrada em `error`
   * dentro de `ProviderResourceBilling`.
   */
  private async applyCancellation(
    gatewaySubscriptionId: string,
  ): Promise<void> {
    const subscription = await this.subscriptions.getSubscriptionByGatewayId(
      gatewaySubscriptionId,
    )

    if (!subscription) {
      this.logUnknown('subscription.deleted', gatewaySubscriptionId)
      return
    }

    /**
     * Já cancelada: reentrega não reescreve e **não desassina de novo**. Repetir o
     * `unsubscribe` é seguro no provider, mas repetir a chamada por reentrega
     * transformaria cada retry deles numa ida à rede sem efeito.
     */
    if (subscription.status === 'cancelled') return

    await this.subscriptions.updateSubscription(subscription.id, {
      status: 'cancelled',
    })

    const items = await this.items.getSubscriptionItemsBySubscription(
      subscription.id,
    )

    for (const item of items) {
      await this.providerBilling.unsubscribe(item)
    }
  }

  private logUnknown(event: string, gatewaySubscriptionId: string): void {
    apiLogger.info(
      { app: 'thinkzap', event, gatewaySubscriptionId },
      'Evento do gateway para assinatura desconhecida na SPA — ignorado; o checkout que vem depois resolve o estado',
    )
  }
}
