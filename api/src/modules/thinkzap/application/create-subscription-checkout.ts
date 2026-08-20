import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { PlanProvider } from '@/modules/application/domain/entities/plan'
import { ensurePlanProviderField } from '@/modules/application/infra/bitrix/ensure-plan-provider-field'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  CheckoutSession,
  PaymentGateway,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import {
  isTrialSubscription,
  resolveCurrentContract,
} from '@/modules/thinkzap/domain/line-subscription'
import { buildContractLineItems } from './helpers/build-contract-line-items'
import { ListOfferablePlans } from './list-offerable-plans'

export class PlanNotOfferableError extends Error {
  constructor(planId: string) {
    super(
      `Plano "${planId}" não é ofertável para esta instalação: precisa estar ativo, ` +
        'ter id no gateway de pagamento, e precificar o mesmo conector que a linha usa.',
    )
    this.name = 'PlanNotOfferableError'
  }
}

export class AlreadySubscribedError extends Error {
  constructor() {
    super(
      'Esta instalação já tem assinatura paga do gateway. Trocar de plano está fora de escopo.',
    )
    this.name = 'AlreadySubscribedError'
  }
}

export type CreateSubscriptionCheckoutInput = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  /** Id do item de plano na SPA de planos. **O único dado que vem do cliente.** */
  planId: string
}

/**
 * Cria a sessão de checkout de um plano ofertável.
 *
 * **Preço, quantidade e período são derivados no servidor.** O corpo da requisição
 * carrega só o id do plano — aceitar qualquer um dos três deixaria o cliente
 * escolher quanto paga.
 *
 * A cobrança montada aqui é o **estado desejado do contrato**: um `line_item` por
 * plano, com a quantidade de linhas de cada um. É a mesma montagem que a criação de
 * linha usa, e é compartilhada de propósito — duas montagens divergiriam, e a
 * divergência apareceria como cliente cobrado por uma linha a mais ou a menos
 * dependendo de por onde entrou.
 */
export class CreateSubscriptionCheckout {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: ListOfferablePlans,
    private readonly gateway: PaymentGateway,
    private readonly bitrix: BitrixClient,
  ) {}

  async execute(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CheckoutSession> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * O campo de provider na SPA de planos, verificado **antes** de criar sessão no
     * gateway. Sem ele todo plano pago resolve provider `undefined` e deixa de ser
     * ofertável — e o sintoma seria "nenhum plano disponível", que não aponta para a
     * causa. Aqui o erro nomeia o campo.
     */
    await ensurePlanProviderField(this.bitrix)

    const contract = resolveCurrentContract(context.subscriptions)
    const current = contract[0] ?? null

    /**
     * O conector que o plano escolhido tem que precificar é o da linha que ele vai
     * cobrar — e a instalação pode ter linhas de dois conectores. O plano é validado
     * contra o **conector dele mesmo**, e a cobrança do contrato inteiro é montada
     * depois: cada conector é precificado pelo plano dele, e nenhum é cobrado pelo
     * preço do outro.
     */
    const chosen = await this.findChosenPlan(input.planId)
    if (!chosen) throw new PlanNotOfferableError(input.planId)

    /**
     * Instalação com assinatura paga do gateway **viva** não contrata de novo:
     * seria troca de plano, que está fora de escopo e exigiria proration. Trial e
     * paga cancelada podem — é justamente o caso que esta superfície existe para
     * resolver. Acrescentar linha a um contrato vivo tem superfície própria, e não
     * passa por aqui.
     */
    if (
      current &&
      !isTrialSubscription(current) &&
      current.modality === 'stripe' &&
      current.status !== 'cancelled'
    ) {
      throw new AlreadySubscribedError()
    }

    /**
     * `quantity` sai da contagem de linhas do contrato, nunca de um campo de
     * entrada. Um `line_item` por plano: a instalação que tem os dois conectores é
     * cobrada pelos dois preços na mesma assinatura do gateway.
     */
    const { lineItems, plansByProvider } = buildContractLineItems({
      contract,
      offerablePlans: await this.plans.listOfferable(),
    })

    /**
     * O plano escolhido tem que precificar um conector que a instalação **usa**.
     *
     * É a mesma proteção que o filtro por provider dava antes de ele sair: sem ela,
     * contratar o plano do Oficial numa instalação que só tem linha Z-API criaria
     * uma sessão que cobra o preço da linha Z-API mas registra o plano do Oficial no
     * metadata — cobrança certa, contrato mentiroso.
     *
     * Instalação sem linha não tem conector a respeitar, e aí qualquer plano
     * ofertável serve.
     */
    if (plansByProvider.size > 0 && !plansByProvider.has(chosen.provider!)) {
      throw new PlanNotOfferableError(input.planId)
    }

    /**
     * Instalação sem linha ainda pode contratar: o `line_item` é o do plano
     * escolhido, com quantidade 1. Sem isso a sessão nasceria sem preço, e o gateway
     * recusaria longe daqui.
     */
    const items =
      lineItems.length > 0
        ? lineItems
        : [{ priceId: chosen.gatewayId!, quantity: 1 }]

    return this.gateway.createCheckoutSession({
      lineItems: items,
      installation: {
        domainId: input.domainId,
        appCode: input.appCode,
        planId: chosen.id,
      },
      intent: { kind: 'convert' },
    })
  }

  /**
   * O plano escolhido, validado pelo predicado de ofertável **e** pelo conector que
   * ele declara.
   *
   * O provider vem do próprio plano em vez da instalação: com os dois conectores
   * possíveis na mesma instalação, comparar com "o conector da instalação" não tem
   * resposta única. O que precisa continuar valendo é que o plano seja ofertável, e
   * `findOfferable` é o mesmo predicado da listagem.
   */
  private async findChosenPlan(planId: string) {
    for (const provider of ['ZAPI', 'HUBMESSAGE'] as PlanProvider[]) {
      const plan = await this.plans.findOfferable(planId, provider)
      if (plan) return plan
    }

    return null
  }
}
