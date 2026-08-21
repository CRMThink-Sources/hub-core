import { env } from '@/config/env'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { planGatewayIdField } from '@/modules/application/infra/bitrix/ensure-plan-gateway-id-fields'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  countActiveLinesByProvider,
  resolvePlanForProvider,
} from '@/modules/thinkzap/domain/line-subscription'
import { GatewayLineItem } from '@/modules/thinkzap/domain/ports/payment-gateway.port'

/**
 * Por que o conector não tem plano — as duas causas têm correções diferentes, e
 * reportar as duas como "não há plano" manda quem lê procurar no lugar errado.
 *
 * `no-plan`: nenhum item de plano declara este conector. É item a **cadastrar** na
 * SPA.
 *
 * `no-price-id`: o item existe e declara o conector, mas o campo de price id do
 * ambiente do gateway em uso está vazio — provavelmente preenchido só no outro
 * ambiente. É campo a **preencher** num item que já está lá.
 */
export type PlanForProviderGap =
  | { kind: 'no-plan' }
  | {
      kind: 'no-price-id'
      /** O campo da SPA que está vazio, com nome de leitura. */
      field: string
      environment: string
      /** Os planos que declaram o conector e estão sem price id aqui. */
      planIds: string[]
    }

export class PlanForProviderMissingError extends Error {
  constructor(
    readonly provider: PlanProvider,
    readonly gap: PlanForProviderGap = { kind: 'no-plan' },
  ) {
    super(
      gap.kind === 'no-price-id'
        ? `O plano do conector ${provider} (${gap.planIds.join(', ')}) está sem price ` +
            `id no ambiente "${gap.environment}" do gateway: o campo ${gap.field} da ` +
            'SPA de planos está vazio. Preencha-o — provavelmente o price id só foi ' +
            'cadastrado no outro ambiente. É configuração ausente na SPA, não falha ' +
            'do cliente.'
        : `Não há plano ativo com id no gateway para o conector ${provider}. ` +
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
  /**
   * O catálogo **sem** o filtro de price id, usado só para explicar a recusa.
   *
   * Existe porque `offerablePlans` já exclui o plano cujo price id está vazio no
   * ambiente em uso, e então "conector sem plano cadastrado" e "plano cadastrado sem
   * price id aqui" chegam aqui idênticos — sendo que um se corrige criando item na
   * SPA e o outro preenchendo um campo. **Não participa da resolução**: incluí-lo em
   * `offerablePlans` faria um plano sem price id disputar com o ofertável e virar
   * `ambiguous`, recusando uma contratação que hoje funciona.
   */
  plansForDiagnosis?: readonly Plan[]
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
/**
 * Qual das duas causas explica a ausência de plano para o conector.
 *
 * Sem catálogo de diagnóstico assume `no-plan`, que é a mensagem que já existia: um
 * chamador que não passa o catálogo não fica pior do que estava.
 */
function explainGap(
  provider: PlanProvider,
  plansForDiagnosis: readonly Plan[] | undefined,
): PlanForProviderGap {
  const declaram = (plansForDiagnosis ?? []).filter(
    plan => plan.provider === provider && plan.active,
  )

  if (declaram.length === 0) return { kind: 'no-plan' }

  return {
    kind: 'no-price-id',
    field: planGatewayIdField(),
    environment: env.payments.stripe.environment,
    planIds: declaram.map(plan => plan.id),
  }
}

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
      throw new PlanForProviderMissingError(
        provider,
        explainGap(provider, input.plansForDiagnosis),
      )
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
    if (!plan.gatewayId) {
      throw new PlanForProviderMissingError(provider, {
        kind: 'no-price-id',
        field: planGatewayIdField(),
        environment: env.payments.stripe.environment,
        planIds: [plan.id],
      })
    }

    lineItems.push({ priceId: plan.gatewayId, quantity })
  }

  return { lineItems, plansByProvider }
}
