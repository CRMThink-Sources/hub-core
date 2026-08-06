import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { SubscriptionModality } from '@/modules/application/domain/entities/subscription'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import {
  composeContractByPlan,
  isTrialSubscription,
  resolveCurrentContract,
} from '@/modules/thinkzap/domain/line-subscription'

/**
 * Um plano cobrado pelo contrato, e quantas linhas ele cobra.
 *
 * Sem `product`, que não diz nada ao cliente, e sem `gatewayId`: o price id não sai
 * da aplicação.
 */
export type LineSubscriptionPlan = {
  id: string
  name: string
  /** Centavos, como no `unit_amount` do gateway. A tela formata. */
  amount: number
  interval: Plan['interval']
  /**
   * Conector que este plano precifica. Ausente no plano de trial, que não precifica
   * nenhum.
   */
  provider?: PlanProvider
  /** Linhas ativas cobradas por este plano. É o `quantity` do `line_item`. */
  lineCount: number
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
      /**
       * A composição do contrato: um item por plano cobrado, com o número de linhas
       * de cada um.
       *
       * Lista, e não um plano só: a instalação pode ser cobrada por mais de um plano
       * na mesma assinatura do gateway — um `line_item` por conector —, e reportar um
       * deles faria a tela mostrar menos do que o cliente paga. Status, período e
       * modalidade continuam saindo uma vez, porque são do contrato e não do plano.
       */
      plans: LineSubscriptionPlan[]
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
      /**
       * A tela pode oferecer a criação de linha.
       *
       * Espelha as guardas de `CreateAdditionalLine`, e por isso vem do servidor: a
       * regra é a mesma que a rota usa para recusar, e duplicá-la na tela deixaria as
       * duas divergirem — com o cliente vendo um botão que responde `409`.
       */
      canCreateLine: boolean
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

    /**
     * O contrato, não a assinatura: as irmãs que compartilham `gatewayId` são o
     * mesmo contrato no gateway, e status e período são delas todas.
     */
    const contract = resolveCurrentContract(context.subscriptions)
    const current = contract[0]
    if (!current) return { status: 'none' }

    const isTrial = isTrialSubscription(current)

    const plans = composeContractByPlan(contract).map(entry => ({
      id: entry.plan.id,
      name: entry.plan.name,
      amount: entry.plan.amount,
      interval: entry.plan.interval,
      provider: entry.plan.provider,
      lineCount: entry.lineCount,
    }))

    const lineCount = plans.reduce((total, plan) => total + plan.lineCount, 0)

    return {
      status: current.status,
      modality: current.modality,
      isTrial,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd,
      plans,
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
      /**
       * Criar linha exige ter linha — a primeira nasce pelo trial — e um contrato que
       * o produto saiba cobrar. Boleto é mantido por automação fora do produto, e o
       * trial é a exceção esperada: ele lê `manual` porque nasce sem o campo, e quem
       * está testando pode contratar uma segunda linha.
       */
      canCreateLine:
        lineCount > 0 && (isTrial || current.modality === 'stripe'),
    }
  }
}
