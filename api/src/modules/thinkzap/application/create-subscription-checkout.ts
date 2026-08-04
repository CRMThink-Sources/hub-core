import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ensurePlanProviderField } from '@/modules/application/infra/bitrix/ensure-plan-provider-field'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  CheckoutSession,
  PaymentGateway,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import {
  isTrialSubscription,
  resolveCurrentSubscription,
  resolveLineProvider,
} from '@/modules/thinkzap/domain/line-subscription'
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

export class MixedLineProvidersError extends Error {
  constructor() {
    super(
      'Esta instalação tem linhas de conectores diferentes, e uma assinatura carrega ' +
        'um plano só — não há preço que cubra os dois. Fale com o suporte.',
    )
    this.name = 'MixedLineProvidersError'
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
     * O conector que a instalação consome vem **antes** da validação do plano: é ele
     * que define o que é ofertável aqui. Sem isso, o plano do conector mais barato
     * seria aceito para uma linha do mais caro, e a diferença sairia do nosso bolso
     * sem aparecer em lugar nenhum.
     */
    const lineProvider = resolveLineProvider(context.subscriptions)

    if (lineProvider === 'MIXED') throw new MixedLineProvidersError()

    /**
     * O campo de provider na SPA de planos, verificado **antes** de criar sessão no
     * gateway. Sem ele todo plano pago resolve provider `undefined` e deixa de ser
     * ofertável — e o sintoma seria "nenhum plano disponível", que não aponta para a
     * causa. Aqui o erro nomeia o campo.
     */
    await ensurePlanProviderField(this.bitrix)

    /**
     * O plano passa pelo **mesmo** predicado da listagem: inativo, sem price id, sem
     * provider, ou de provider incompatível é recusado **antes** de criar sessão no
     * gateway. Criar primeiro deixaria sessão órfã lá a cada tentativa.
     */
    const plan = await this.plans.findOfferable(input.planId, lineProvider)
    if (!plan?.gatewayId) throw new PlanNotOfferableError(input.planId)

    const current = resolveCurrentSubscription(context.subscriptions)

    /**
     * Instalação com assinatura paga do gateway **viva** não contrata de novo:
     * seria troca de plano, que está fora de escopo e exigiria proration. Trial e
     * paga cancelada podem — é justamente o caso que esta superfície existe para
     * resolver.
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
     * `quantity` é o número de linhas da instalação, não um campo de entrada. Hoje
     * é sempre 1, porque criar linha adicional está fora de escopo — o cálculo
     * existe desde já para que "assinar" não precise ser reescrito quando a
     * segunda linha entrar: o que muda lá é quem incrementa, não a forma.
     */
    const quantity = Math.max(1, this.countLines(context))

    return this.gateway.createCheckoutSession({
      priceId: plan.gatewayId,
      quantity,
      installation: {
        domainId: input.domainId,
        appCode: input.appCode,
        planId: plan.id,
      },
    })
  }

  /** Linhas ativas da instalação, somando todas as assinaturas dela. */
  private countLines(context: {
    subscriptions: Array<{ items: Array<{ status: string }> }>
  }): number {
    return context.subscriptions
      .flatMap(subscription => subscription.items)
      .filter(item => item.status === 'active').length
  }
}
