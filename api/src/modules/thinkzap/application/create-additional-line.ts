import { randomUUID } from 'node:crypto'

import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  isTrialSubscription,
  resolveCurrentContract,
} from '@/modules/thinkzap/domain/line-subscription'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { buildContractLineItems } from './helpers/build-contract-line-items'
import {
  lineNameFor,
  resourceRefOf,
  toLineMetadata,
} from './helpers/line-resource-metadata'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'

export class NoLineToExtendError extends Error {
  constructor() {
    super(
      'Esta instalação não tem nenhuma linha. A primeira linha nasce pelo período ' +
        'de teste, que é a superfície que existe para o primeiro conector.',
    )
    this.name = 'NoLineToExtendError'
  }
}

export class ManualModalityCannotCreateLineError extends Error {
  constructor() {
    super(
      'Esta assinatura é mantida por fora do produto (boleto), então criar linha aqui ' +
        'não ajustaria a cobrança dela. Fale com o suporte.',
    )
    this.name = 'ManualModalityCannotCreateLineError'
  }
}

export class PlanDoesNotPriceProviderError extends Error {
  constructor(planId: string, provider: PlanProvider) {
    super(
      `O plano "${planId}" não precifica o conector ${provider}: precisa estar ativo, ` +
        'ter id no gateway de pagamento e declarar este conector.',
    )
    this.name = 'PlanDoesNotPriceProviderError'
  }
}

export type CreateAdditionalLineInput = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  /** Conector da linha nova. */
  provider: PlanProvider
  /** Plano que a precifica, na SPA de planos. **O único preço que vem do cliente.** */
  planId: string
}

export type CreateAdditionalLineOutput =
  /** Linha criada no mesmo request: o contrato já existia no gateway. */
  | { kind: 'created'; item: SubscriptionItem }
  /** Precisa de pagamento: o segredo da sessão embedada que a tela monta. */
  | { kind: 'checkout'; clientSecret: string }

/**
 * Cria uma linha adicional numa instalação que já tem linha.
 *
 * Dois caminhos, escolhidos pelo **estado da instalação** e não por um campo do
 * corpo — aceitar a intenção pelo corpo deixaria o cliente pedir "acrescenta sem
 * cobrar":
 *
 * ```
 * assinatura paga viva no gateway?
 *  ├── sim → ajusta os line_items da assinatura existente. Sem checkout: o meio de
 *  │         pagamento está em arquivo e o gateway cobra a diferença proporcional.
 *  └── não → checkout embedado, carregando TODAS as linhas a cobrar. A do trial
 *            entra na assinatura no mesmo ato.
 * ```
 *
 * No caminho sem checkout a ordem é obrigatória (decisão 4 do design):
 *
 * ```
 * 1. provisionar no provider   ← falha: nada aconteceu, cliente não pagou
 * 2. cobrar no gateway         ← falha: recurso órfão, NÓS pagamos por ele
 * 3. criar o item na SPA       ← falha: cliente pagou e não tem a linha
 * 4. subscribe no provider     ← nunca lança; falha vira log de error
 * ```
 *
 * Provisionar primeiro porque é o passo mais provável de falhar e o único que ainda
 * não custa nada ao cliente. Cobrar antes de escrever na SPA porque item criado com
 * a cobrança falhando é uma **linha que funciona e não é cobrada** — perda
 * silenciosa que ninguém reclama —, enquanto cobrança feita e item faltando é
 * visível para o cliente no mesmo minuto.
 */
export class CreateAdditionalLine {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: ListOfferablePlans,
    private readonly gateway: PaymentGateway,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
    private readonly providerResolver: ConnectorProviderResolver,
    private readonly providerBilling: ProviderResourceBilling,
  ) {}

  async execute(
    input: CreateAdditionalLineInput,
  ): Promise<CreateAdditionalLineOutput> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * O plano da linha nova passa pelo **mesmo** predicado da listagem, e casado com
     * o conector pedido: sem isso, uma linha `business` contrataria o plano do `web`
     * e pagaria menos do que consome, em silêncio.
     */
    const plan = await this.plans.findOfferable(input.planId, input.provider)
    if (!plan) {
      throw new PlanDoesNotPriceProviderError(input.planId, input.provider)
    }

    const contract = resolveCurrentContract(context.subscriptions)
    const existingLines = this.linesOf(contract)

    /**
     * Instalação sem linha não estende nada. A recusa nomeia o trial em vez de
     * cobrar: a primeira linha é gratuita por decisão de produto, e cobrar aqui
     * tiraria o teste de quem nunca usou.
     */
    if (existingLines.length === 0) throw new NoLineToExtendError()

    const current = contract[0]!
    const isTrial = isTrialSubscription(current)

    /**
     * A modalidade só é consultada quando o contrato é **pago**: a assinatura de
     * trial nasce sem o campo, e a leitura tolerante resolve `manual` para ela — a
     * checagem invertida recusaria justamente quem está testando.
     */
    if (!isTrial && current.modality === 'manual') {
      throw new ManualModalityCannotCreateLineError()
    }

    /**
     * A cobrança inteira do contrato é montada **antes** de qualquer efeito: é aqui
     * que plano ausente e plano ambíguo aparecem, e os dois têm que aparecer antes de
     * provisionar recurso ou tocar o gateway.
     */
    const desired = buildContractLineItems({
      contract,
      offerablePlans: await this.plans.listOfferable(),
      additional: { provider: input.provider, plan },
    })

    const gatewayId = this.liveGatewayContract(current, isTrial)

    if (!gatewayId) {
      const session = await this.gateway.createCheckoutSession({
        lineItems: desired.lineItems,
        installation: {
          domainId: input.domainId,
          appCode: input.appCode,
          planId: plan.id,
        },
        intent: {
          kind: 'add-line',
          provider: input.provider,
          planId: plan.id,
        },
      })

      return { kind: 'checkout', clientSecret: session.clientSecret }
    }

    return {
      kind: 'created',
      item: await this.createOnLiveContract({
        input,
        contract,
        gatewayId,
        plan,
        lineItems: desired.lineItems,
        lineOrder: existingLines.length + 1,
        customerName: context.customer.name,
        aplicationTitle: context.aplication.title,
        aplicationSpaId: context.aplication.spaId,
      }),
    }
  }

  /**
   * Cria a linha num contrato que já existe no gateway, na ordem obrigatória.
   */
  private async createOnLiveContract(args: {
    input: CreateAdditionalLineInput
    contract: (Subscription & { items: SubscriptionItem[] })[]
    gatewayId: string
    plan: Plan
    lineItems: { priceId: string; quantity: number }[]
    lineOrder: number
    customerName: string
    aplicationTitle: string
    aplicationSpaId: string | null
  }): Promise<SubscriptionItem> {
    const provider = this.toConnectorProvider(args.input.provider)

    // ── Passo 1: o recurso no provider. Falhar aqui não cobra nada.
    const adapter = this.providerResolver.resolve(provider)
    const resource = await adapter.provisionConnector({
      name: `${args.customerName} | line-${randomUUID()}`,
    })

    /**
     * A credencial é validada **antes** de cobrar: linha sem credencial nunca
     * conectaria, e o cliente teria pago por ela.
     */
    const metadata = toLineMetadata(provider, resource)

    // ── Passo 2: a cobrança. Falhar aqui deixa o recurso órfão — e registrado.
    try {
      await this.gateway.syncSubscriptionLineItems({
        gatewaySubscriptionId: args.gatewayId,
        lineItems: args.lineItems,
      })
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          domainId: args.input.domainId,
          appCode: args.input.appCode,
          provider: args.input.provider,
          orphanRemoteId: resourceRefOf(provider, resource),
          err: error,
        },
        'Recurso provisionado no provider e a cobrança não foi ajustada — recurso órfão, e nós pagamos por ele',
      )
      throw error
    }

    // ── Passo 3: a linha na SPA. Falhar aqui é o risco concentrado.
    let item: SubscriptionItem
    try {
      const parent = await this.resolveParentSubscription(args)

      item = await this.items.createSubscriptionItem({
        name: lineNameFor(provider, args.lineOrder),
        subscription: parent.id,
        status: 'active',
        metadata,
      })
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          domainId: args.input.domainId,
          appCode: args.input.appCode,
          gatewaySubscriptionId: args.gatewayId,
          planId: args.plan.id,
          provider: args.input.provider,
          remoteId: resourceRefOf(provider, resource),
          err: error,
        },
        'Cobrança ajustada e a linha não foi criada na SPA — cliente pagou e não tem a linha; criar o item à mão no CRM com esta credencial',
      )
      throw error
    }

    /**
     * ── Passo 4: a cobrança do recurso com o **provider**, depois de a linha
     * existir. `subscribe` nunca lança: nesse ponto o cliente pagou e a linha
     * funciona, então falhar aqui é problema de operação, não de produto.
     *
     * Só a linha nova. Reassinar as que já estavam assinadas seria uma ida à rede
     * por linha em cada criação, sem efeito nenhum.
     */
    await this.providerBilling.subscribe(item)

    return item
  }

  /**
   * A assinatura que vai cobrar a linha nova: a irmã do plano dela, criada quando
   * aquele plano ainda não tem uma.
   *
   * Uma assinatura por plano na SPA é o que mantém `Subscription.plan` descrevendo
   * honestamente a cobrança do grupo — pendurar a linha do Oficial na assinatura do
   * plano do Web faria a tela mostrar o preço errado para ela.
   *
   * A irmã nasce com o **status e o período do contrato**, não com `active` fixo:
   * criar linha num contrato `past_due` tem que nascer bloqueada junto com as
   * outras, porque o entitlement é do pai.
   */
  private async resolveParentSubscription(args: {
    contract: (Subscription & { items: SubscriptionItem[] })[]
    gatewayId: string
    plan: Plan
    aplicationTitle: string
    aplicationSpaId: string | null
  }): Promise<Subscription> {
    const sibling = args.contract.find(
      subscription => subscription.plan.id === args.plan.id,
    )
    if (sibling) return sibling

    if (!args.aplicationSpaId) {
      throw new Error(
        'Instalação sem espelho na SPA de aplicações: sem ele não há parent onde ' +
          'pendurar a assinatura do plano novo',
      )
    }

    const current = args.contract[0]!

    return this.subscriptions.createSubscription({
      name: `${args.plan.name} — ${args.aplicationTitle}`,
      planId: args.plan.id,
      aplicationSpaId: args.aplicationSpaId,
      status: current.status,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd,
      gatewayId: args.gatewayId,
      modality: 'stripe',
    })
  }

  /**
   * O id no gateway quando o contrato é pago e **vivo lá**, ou `null`.
   *
   * `cancelled` não conta: a assinatura não existe mais no gateway, então não há
   * `line_item` a ajustar — o caminho é contratar de novo, com checkout. `past_due`
   * conta: a assinatura existe, e acrescentar linha a ela é ajuste de cobrança, não
   * contratação nova.
   */
  private liveGatewayContract(
    current: Subscription,
    isTrial: boolean,
  ): string | null {
    if (isTrial) return null
    if (current.modality !== 'stripe') return null
    if (current.status !== 'active' && current.status !== 'past_due')
      return null

    return current.gatewayId ?? null
  }

  /** As linhas do contrato: item ativo com conector. Item de cobrança não é linha. */
  private linesOf(
    contract: readonly { items: SubscriptionItem[] }[],
  ): SubscriptionItem[] {
    return contract.flatMap(subscription =>
      subscription.items.filter(
        item => item.status === 'active' && item.metadata.provider !== 'NONE',
      ),
    )
  }

  private toConnectorProvider(provider: PlanProvider): ConnectorProvider {
    return provider === 'HUBMESSAGE'
      ? ConnectorProvider.HUBMESSAGE
      : ConnectorProvider.ZAPI
  }
}
