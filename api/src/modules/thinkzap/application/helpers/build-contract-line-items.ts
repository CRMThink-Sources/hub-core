import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  countActiveLinesByProvider,
  resolvePlanForProvider,
} from '@/modules/thinkzap/domain/line-subscription'
import { GatewayLineItem } from '@/modules/thinkzap/domain/ports/payment-gateway.port'

export class PlanForProviderMissingError extends Error {
  constructor(readonly provider: PlanProvider) {
    super(
      `Não há plano ativo com id no gateway para o conector ${provider}. ` +
        'É configuração ausente na SPA de planos, não falha do cliente.',
    )
    this.name = 'PlanForProviderMissingError'
  }
}

export class PlanForProviderAmbiguousError extends Error {
  constructor(
    readonly provider: PlanProvider,
    readonly planIds: string[],
  ) {
    super(
      `O conector ${provider} tem mais de um plano ofertável (${planIds.join(', ')}), ` +
        'então não há como saber qual precifica a linha que já existe. Contrate essa ' +
        'linha primeiro pelo botão de assinatura e depois crie a nova.',
    )
    this.name = 'PlanForProviderAmbiguousError'
  }
}

export type BuildContractLineItemsInput = {
  /**
   * As assinaturas do contrato vigente — não todas as da instalação. Uma linha tem
   * um pai só, e contar fora do contrato somaria itens de assinaturas superadas.
   */
  contract: readonly { items: SubscriptionItem[] }[]
  /** O catálogo ofertável inteiro: `active`, com price id e com provider. */
  offerablePlans: readonly Plan[]
  /** Linha a acrescentar, quando a cobrança está sendo montada para criar uma. */
  additional?: { provider: PlanProvider; plan: Plan }
}

export type ContractLineItems = {
  /** Um item por plano, com a quantidade final de linhas daquele plano. */
  lineItems: GatewayLineItem[]
  /** O plano que precifica cada conector presente no contrato. */
  plansByProvider: Map<PlanProvider, Plan>
}

/**
 * O estado **desejado** da cobrança do contrato: um `line_item` por plano, com
 * `quantity` igual ao número de linhas daquele plano.
 *
 * Existe uma vez e é usado pelas duas superfícies que cobram — contratar e criar
 * linha. Duas montagens separadas divergiriam, e a divergência apareceria como
 * cliente cobrado por uma linha a mais ou a menos, dependendo de por onde entrou.
 *
 * O plano de uma linha que **já existe** é resolvido pelo conector dela, e não vem
 * do corpo da requisição: aceitar o plano de cada linha seria deixar o cliente
 * escolher quanto paga por cada uma. Quando o conector tem mais de um plano
 * ofertável, a função **recusa** em vez de escolher — escolher cobraria o preço de
 * um plano pelo uso de outro, em silêncio.
 */
export function buildContractLineItems(
  input: BuildContractLineItemsInput,
): ContractLineItems {
  const counts = countActiveLinesByProvider(input.contract)

  if (input.additional) {
    const { provider } = input.additional
    counts.set(provider, (counts.get(provider) ?? 0) + 1)
  }

  const plansByProvider = new Map<PlanProvider, Plan>()

  for (const provider of counts.keys()) {
    /**
     * O plano da linha nova vem escolhido, e passa na frente da resolução por
     * conector: é o único plano que o cliente pode escolher, e ele já foi validado
     * como ofertável para este conector.
     */
    if (input.additional?.provider === provider) {
      plansByProvider.set(provider, input.additional.plan)
      continue
    }

    const resolved = resolvePlanForProvider(input.offerablePlans, provider)

    if (resolved.kind === 'missing') {
      throw new PlanForProviderMissingError(provider)
    }
    if (resolved.kind === 'ambiguous') {
      throw new PlanForProviderAmbiguousError(provider, resolved.planIds)
    }

    plansByProvider.set(provider, resolved.plan)
  }

  const lineItems: GatewayLineItem[] = []

  for (const [provider, quantity] of counts) {
    const plan = plansByProvider.get(provider)!

    /**
     * `gatewayId` é garantido pelo predicado de ofertável, e o `!` seria a única
     * coisa entre um plano sem price id e um `line_item` sem preço — que o gateway
     * recusa longe daqui.
     */
    if (!plan.gatewayId) throw new PlanForProviderMissingError(provider)

    lineItems.push({ priceId: plan.gatewayId, quantity })
  }

  return { lineItems, plansByProvider }
}
