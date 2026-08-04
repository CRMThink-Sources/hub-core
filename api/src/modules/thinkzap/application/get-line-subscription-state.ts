import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan } from '@/modules/application/domain/entities/plan'
import { SubscriptionModality } from '@/modules/application/domain/entities/subscription'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import {
  isTrialSubscription,
  resolveCurrentSubscription,
} from '@/modules/thinkzap/domain/line-subscription'

/** O plano como a tela precisa dele. Sem `product`, que não diz nada ao cliente. */
export type LineSubscriptionPlan = {
  id: string
  name: string
  /** Centavos, como no `unit_amount` do gateway. A tela formata. */
  amount: number
  interval: Plan['interval']
}

/**
 * Estado da assinatura de uma instalação, para a tela decidir o que oferecer.
 *
 * `currentPeriodEnd` vai cru: fuso e formatação são da tela, que tem o locale do
 * operador.
 *
 * **Nenhum campo de credencial do gateway aparece aqui** — nem chave de API, nem
 * segredo de webhook, nem o `gatewayId` da assinatura. A tela não precisa do id
 * para abrir o portal (a rota resolve no servidor), e o que não é enviado não
 * vaza.
 */
export type LineSubscriptionState =
  /** Instalação sem assinatura nenhuma. A tela oferece o teste. */
  | { status: 'none' }
  | {
      status: 'active' | 'past_due' | 'cancelled' | 'trialing'
      /**
       * Como a assinatura é cobrada. Governa o que a tela oferece: só a
       * modalidade do gateway tem portal de faturamento.
       */
      modality: SubscriptionModality
      /** Assinatura de teste — plano sem id no gateway. */
      isTrial: boolean
      currentPeriodStart: Date
      currentPeriodEnd: Date
      plan: LineSubscriptionPlan
      /**
       * Habilitação resolvida da assinatura vigente e do agora. É o que a tela usa
       * para dizer se a linha funciona, em vez de reinterpretar `status` e período
       * por conta própria — duas implementações da mesma regra divergiriam.
       */
      entitlement: LineEntitlement
      /**
       * A tela pode oferecer o portal de faturamento. `false` para boleto: não
       * existe portal do gateway para assinatura que não é dele, e oferecer daria
       * erro na cara do cliente.
       */
      billingPortalAvailable: boolean
      /** A tela pode oferecer contratação — sem contrato pago vigente. */
      canSubscribe: boolean
    }

/**
 * Lê o estado da assinatura da instalação atual.
 *
 * Só leitura, e só da SPA: o gateway de pagamento **não** é consultado. O estado
 * que o runtime obedece é o da SPA, e é o mesmo que a tela mostra — consultar o
 * gateway aqui criaria uma segunda resposta possível para a mesma pergunta.
 */
export class GetLineSubscriptionState {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    input: { domainId: string; appCode: string },
    now: Date = new Date(),
  ): Promise<LineSubscriptionState> {
    const context = await this.getAplicationContext.execute(input)

    const current = resolveCurrentSubscription(context.subscriptions)
    if (!current) return { status: 'none' }

    const isTrial = isTrialSubscription(current)

    return {
      status: current.status,
      modality: current.modality,
      isTrial,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd,
      plan: {
        id: current.plan.id,
        name: current.plan.name,
        amount: current.plan.amount,
        interval: current.plan.interval,
      },
      entitlement: resolveLineEntitlement(current, now),
      /**
       * Portal só para assinatura do gateway **e** que ainda existe lá: uma paga
       * cancelada não tem cartão a gerenciar, e o portal abriria numa assinatura
       * encerrada.
       */
      billingPortalAvailable:
        current.modality === 'stripe' &&
        !isTrial &&
        current.status !== 'cancelled',
      /**
       * Contratar é oferecido quando não há contrato pago vigente: trial (em
       * andamento ou vencido) e assinatura paga cancelada. Trocar de plano está
       * fora de escopo, então quem tem paga viva não recebe a oferta.
       */
      canSubscribe: isTrial || current.status === 'cancelled',
    }
  }
}
