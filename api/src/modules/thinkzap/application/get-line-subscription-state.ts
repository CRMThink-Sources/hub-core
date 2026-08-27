import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { PlanPrice } from '@/modules/application/domain/entities/plan-price'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import { SubscriptionModality } from '@/modules/application/domain/entities/subscription'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { GatewaySubscriptionReader } from '@/modules/application/domain/repositories/gateway-subscription.reader'
import {
  composeContractBilling,
  composeContractByPlan,
  isTrialSubscription,
  resolveCurrentContract,
} from '@/modules/thinkzap/domain/line-subscription'
import { planAmountForLines } from '@/modules/thinkzap/domain/plan-pricing'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Um plano cobrado pelo contrato, e quantas linhas ele cobra.
 *
 * Sem `product`, que não diz nada ao cliente, e sem `gatewayId`: o price id não sai
 * da aplicação.
 */
export type LineSubscriptionPlan = {
  id: string
  name: string
  /**
   * Valor de cadastro do CRM, em centavos. **Não é o cobrado** — ver `Plan.amount`.
   * Vai na resposta só para o diagnóstico de tela; nenhuma superfície deve
   * multiplicá-lo pela contagem de linhas.
   */
  amount: number
  /**
   * Quanto este plano custa no contrato, em centavos, já com os degraus do gateway
   * aplicados sobre `lineCount`.
   *
   * É **este** o número que a tela mostra. `amount × lineCount` é conta errada em
   * price escalonado: sob degraus 287/187, três linhas custam R$ 661,00 e a
   * multiplicação diz R$ 861,00.
   *
   * `null` quando o preço não pôde ser resolvido — gateway indisponível, ou modo de
   * escalonamento que o produto não calcula. A tela mostra a linha do plano sem
   * valor, em vez de um número inventado.
   */
  chargedAmount: number | null
  interval: Plan['interval']
  /**
   * Conector que este plano precifica. Ausente no plano de trial, que não precifica
   * nenhum.
   */
  provider?: PlanProvider
  /** Linhas ativas deste plano na SPA. É o que a instalação **usa**. */
  lineCount: number
  /**
   * Linhas que o gateway **cobra** deste plano — a `quantity` do `line_item`.
   *
   * Diverge de `lineCount` por construção quando existe linha de cortesia, e é dessa
   * diferença que sai `compedCount`. Vem do gateway, nunca da SPA: a SPA não sabe o
   * que é cobrado.
   */
  billedCount: number
  /** Linhas além das cobradas. Nunca negativo — ver `composeContractBilling`. */
  compedCount: number
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
       *
       * **Ausente** quando os dados de cobrança não puderam ser obtidos — gateway
       * fora, sem credencial, assinatura inexistente lá, ou modalidade que não é do
       * gateway. Ausência é a resposta honesta: preencher com `amount × lineCount`
       * devolveria o número que não bate com a fatura, que é o que esta superfície
       * existe para corrigir.
       */
      plans?: LineSubscriptionPlan[]
      /**
       * O total cobrado do contrato, em centavos — a soma dos `chargedAmount`.
       *
       * Somado no servidor porque somar é parte da regra de preço. `null` quando
       * algum plano ficou sem preço resolvido: um total que ignora um plano é um
       * número menor apresentado como se fosse o completo. **Ausente** quando `plans`
       * é ausente, pelo mesmo motivo.
       */
      contractTotal?: number | null
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
 * O valor cobrado de um plano, ou `null` quando não há como sabê-lo.
 *
 * Trial não tem preço e não tem o que cobrar: zero é a resposta certa, e não
 * "desconhecido" — a assinatura de teste é gratuita por construção.
 *
 * Preço ausente num plano **pago** é outra coisa: é falha de leitura no gateway ou
 * modo de escalonamento não suportado, e aí `null` é honesto. Devolver zero diria à
 * tela que o cliente não paga nada.
 */
function resolveChargedAmount(
  plan: Plan,
  price: PlanPrice | null,
  lineCount: number,
): number | null {
  if (!plan.gatewayId) return 0
  if (!price) return null

  try {
    return planAmountForLines({
      planId: plan.id,
      price,
      lines: lineCount,
    })
  } catch (error) {
    apiLogger.warn(
      { app: 'payments', planId: plan.id, error },
      'Valor do plano não pôde ser calculado — a tela mostra o plano sem valor',
    )
    return null
  }
}

/**
 * Lê o estado da assinatura da instalação atual.
 *
 * **A fronteira com o gateway é estreita, e de propósito.** Status, período,
 * modalidade e habilitação saem da SPA — é o estado que o runtime obedece, e ter uma
 * segunda fonte para "a linha funciona?" faria as duas divergirem. Do gateway vem
 * uma coisa só: **quanto é cobrado, e por quantas linhas**. Essa pergunta a SPA não
 * responde, porque linha de cortesia existe nela e não no `line_item`.
 */
export class GetLineSubscriptionState {
  /**
   * @param prices Leitura do preço no gateway, para a tela mostrar o valor cobrado.
   * Opcional: sem ela o estado sai com `chargedAmount` nulo, o que é o comportamento
   * certo para quem não tem gateway configurado. O tipo é o **port**, nunca o adapter
   * — este módulo é entrypoint de runtime, e `runtime-gateway-isolation.test.ts`
   * reprova qualquer caminho de import que alcance o Stripe daqui.
   * @param gatewaySubscriptions Leitura da assinatura no gateway, pela `quantity` de
   * cada item. Opcional pelo mesmo motivo, e com a mesma restrição de tipo. Sem ela o
   * estado sai **sem** composição — não com uma composição estimada.
   */
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly prices?: PlanPriceReader,
    private readonly gatewaySubscriptions?: GatewaySubscriptionReader,
  ) {}

  /**
   * A assinatura no gateway, ou `null` quando não há como sabê-la.
   *
   * `null` cobre quatro casos que a tela trata igual — sem reader configurado,
   * contrato sem id no gateway, modalidade que não é do gateway, e leitura falha — e
   * todos levam ao mesmo lugar: a resposta sai sem composição, e a tela mostra só o
   * período. Distinguí-los na resposta não mudaria nada do que o cliente vê.
   */
  private async readGatewaySubscription(
    current: { modality: SubscriptionModality; gatewayId?: string },
    isTrial: boolean,
  ): Promise<GatewaySubscription | null> {
    if (!this.gatewaySubscriptions) return null
    if (isTrial) return null
    if (current.modality !== 'stripe') return null
    if (!current.gatewayId) return null

    try {
      return await this.gatewaySubscriptions.readSubscription(current.gatewayId)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', gatewaySubscriptionId: current.gatewayId, error },
        'Assinatura não pôde ser lida no gateway — a tela mostra só o período vigente',
      )
      return null
    }
  }

  /**
   * O preço de cada plano do contrato, por price id.
   *
   * Uma leitura por price distinto, não por assinatura: um contrato com duas linhas do
   * mesmo conector tem duas assinaturas irmãs apontando para o mesmo price.
   */
  private async readPrices(
    plans: readonly Plan[],
  ): Promise<Map<string, PlanPrice>> {
    const byPriceId = new Map<string, PlanPrice>()
    if (!this.prices) return byPriceId

    const priceIds = [
      ...new Set(
        plans.flatMap(plan => (plan.gatewayId ? [plan.gatewayId] : [])),
      ),
    ]

    await Promise.all(
      priceIds.map(async priceId => {
        try {
          byPriceId.set(priceId, await this.prices!.readPrice(priceId))
        } catch (error) {
          apiLogger.warn(
            { app: 'payments', priceId, error },
            'Preço não pôde ser lido no gateway — a tela mostra o plano sem valor',
          )
        }
      }),
    )

    return byPriceId
  }

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

    const composed = composeContractByPlan(contract)

    const [gatewaySubscription, pricesByPriceId] = await Promise.all([
      this.readGatewaySubscription(current, isTrial),
      this.readPrices(composed.map(entry => entry.plan)),
    ])

    /**
     * A composição existe **só** com a leitura do gateway em mãos.
     *
     * Sem ela não há como separar cobrada de bonificada, e o valor teria que sair de
     * `amount × lineCount` — a conta que anuncia mais do que a fatura cobra. A
     * resposta então omite a composição, e a tela cai na forma reduzida.
     */
    const billing = gatewaySubscription
      ? composeContractBilling(composed, gatewaySubscription.items)
      : null

    const plans = billing?.map(entry => ({
      id: entry.plan.id,
      name: entry.plan.name,
      amount: entry.plan.amount,
      /**
       * Sobre `billedCount`, e não `lineCount`: com 3 linhas e 2 cobradas, cobrar o
       * preço de 3 mostraria bonificado e o valor cheio ao mesmo tempo.
       */
      chargedAmount: resolveChargedAmount(
        entry.plan,
        entry.plan.gatewayId
          ? (pricesByPriceId.get(entry.plan.gatewayId) ?? null)
          : null,
        entry.billedCount,
      ),
      interval: entry.plan.interval,
      provider: entry.plan.provider,
      lineCount: entry.lineCount,
      billedCount: entry.billedCount,
      compedCount: entry.compedCount,
    }))

    /**
     * O gateway cobra mais linhas do que a SPA tem ativas. Não muda o que a tela
     * mostra — o número da fatura é o do gateway —, mas é o sintoma de SPA e gateway
     * separados, e sem registro ninguém nota.
     */
    for (const entry of billing ?? []) {
      if (!entry.overBilled) continue

      apiLogger.warn(
        {
          app: 'payments',
          planId: entry.plan.id,
          billedCount: entry.billedCount,
          lineCount: entry.lineCount,
        },
        'Gateway cobra mais linhas do que a SPA tem ativas — divergência a reconciliar',
      )
    }

    const lineCount = composed.reduce(
      (total, entry) => total + entry.lineCount,
      0,
    )

    /**
     * O total é somado aqui, e não na tela: somar é parte da regra de preço, e a tela
     * somando `amount × lineCount` foi exatamente o que passou a mostrar mais do que a
     * fatura. Plano com preço irresolúvel não entra na soma, e `contractTotal` fica
     * `null` — total parcial passaria por total.
     */
    const contractTotal = !plans
      ? undefined
      : plans.some(plan => plan.chargedAmount === null)
        ? null
        : plans.reduce((total, plan) => total + (plan.chargedAmount ?? 0), 0)

    return {
      status: current.status,
      modality: current.modality,
      isTrial,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd,
      plans,
      contractTotal,
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
