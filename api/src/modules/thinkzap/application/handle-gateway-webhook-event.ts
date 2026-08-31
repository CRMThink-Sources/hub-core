import type { Subscription } from '@/modules/application/domain/entities/subscription'
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
 * | `checkout.completed` | a ativação, mais `subscribe` no provider de cada linha |
 * | `subscription.updated` | `status` e período — é o que reflete recusa e recuperação |
 * | `subscription.deleted` | `status: 'cancelled'`, mais `unsubscribe` no provider |
 *
 * **O `gatewayId` identifica um conjunto de assinaturas, não uma.** Uma instalação
 * cobrada por dois planos tem uma assinatura por plano na SPA, as duas com o mesmo
 * id no gateway. Status e período são escritos em **todas**: escrever numa só
 * bloquearia metade das linhas do cliente num `past_due`, e destravaria metade na
 * recuperação.
 *
 * **Evento fora de ordem é ignorado com log, não erro.** Um `updated` que chega
 * antes do `checkout.completed` não encontra nenhuma assinatura com aquele
 * `gatewayId`; falhar faria o gateway reentregar em backoff até desistir, e o
 * `completed` que vem depois resolve o estado de qualquer forma.
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

  /**
   * Grava status e período em **todas** as assinaturas do contrato.
   *
   * **Nenhuma operação de provider acontece aqui**, e isso inclui `past_due`:
   * inadimplência é falha transitória de cartão. Desassinar e reassinar a cada
   * recusa churna a cobrança do provider, e desconectar obrigaria o cliente a ler o
   * QR de novo por um pagamento que se resolve em dias. O bloqueio no app já basta,
   * e a recuperação religa sozinha — sem `subscribe` de novo, porque nunca
   * desassinou.
   *
   * **Quantidade do evento não cria nem cancela linha.** Um `line_item` com
   * quantidade diferente da contagem de itens na SPA é divergência a reconciliar, e
   * a SPA é a fonte de verdade do que existe — provisionar ou cancelar linha a
   * partir de um número vindo do gateway apagaria a linha que o cliente usa.
   */
  private async applyStatus(
    gatewaySubscriptionId: string,
    patch: {
      /**
       * A união do domínio, como o evento do port já declara. O gateway não emite
       * `trial_expired` — expiração de teste é do produto, não da fatura —, mas
       * replicar a lista aqui só criava um segundo lugar para dessincronizar.
       */
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
      /**
       * Idempotente por comparação de estado: reentrega do mesmo evento encontra a
       * assinatura já no estado final e não escreve — o que evita invalidar o cache
       * e refazer a leitura do Bitrix por nada.
       */
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

  /**
   * Cancela na SPA e **desassina** o recurso no provider — em cada assinatura do
   * contrato, e para cada linha de cada uma.
   *
   * A ordem importa: a SPA primeiro, porque é o que bloqueia a linha. Falha do
   * `unsubscribe` não desfaz o cancelamento — a linha continua bloqueada, e o
   * problema que sobra é nossa cobrança com o provider, registrada em `error`
   * dentro de `ProviderResourceBilling`.
   */
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
      /**
       * Já cancelada: reentrega não reescreve e **não desassina de novo**. Repetir o
       * `unsubscribe` é seguro no provider, mas repetir a chamada por reentrega
       * transformaria cada retry deles numa ida à rede sem efeito.
       */
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

      /**
       * Desassina só o que foi cancelado: falhar a escrita e desassinar de qualquer
       * forma deixaria a linha cobrada no app e desassinada no provider — cliente
       * pagando por recurso que o provider vai cortar.
       */
      if (!written) continue

      const items = await this.items.getSubscriptionItemsBySubscription(
        subscription.id,
      )

      for (const item of items) {
        await this.providerBilling.unsubscribe(item)
      }
    }
  }

  /**
   * Registra quando a quantidade cobrada no gateway não bate com as linhas na SPA.
   *
   * **Não cria e não cancela nada.** A SPA é a fonte de verdade do que existe:
   * provisionar por um número vindo do gateway criaria linha que ninguém pediu, e
   * cancelar apagaria a linha que o cliente usa. O caminho real dessa divergência é
   * o portal de faturamento, onde o cliente pode editar quantidade — e sem este log
   * ninguém nota até a conta não fechar.
   */
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

    apiLogger.warn(
      {
        app: 'thinkzap',
        event: 'subscription.updated',
        gatewaySubscriptionId,
        subscriptionIds,
        gatewayQuantity: totalLineQuantity,
        spaLineCount: lines,
      },
      'Quantidade cobrada no gateway diverge das linhas na SPA — nada foi criado nem cancelado; reconciliar à mão',
    )
  }

  /**
   * Escreve numa assinatura do contrato, e **não deixa a falha derrubar as irmãs**.
   *
   * Abortar no primeiro erro deixaria o resto do contrato com status divergente —
   * metade das linhas do cliente bloqueada por metade de um evento. O log nomeia
   * qual falhou, e a reentrega do gateway corrige, porque a escrita é idempotente.
   */
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
      apiLogger.error(
        {
          app: 'thinkzap',
          event,
          gatewaySubscriptionId,
          subscriptionId,
          err: error,
        },
        'Falha ao escrever o estado do gateway numa assinatura do contrato — as demais seguem, e a reentrega corrige',
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
