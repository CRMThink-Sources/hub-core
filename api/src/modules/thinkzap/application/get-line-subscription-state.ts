import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { PlanPrice } from '@/modules/application/domain/entities/plan-price'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import {
  Subscription,
  SubscriptionModality,
} from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { GatewaySubscriptionReader } from '@/modules/application/domain/repositories/gateway-subscription.reader'
import {
  composeContractBilling,
  composeContractByProvider,
  countActiveLinesByProvider,
  isTrialSubscription,
  resolveCurrentContract,
  type ContractComposition,
} from '@/modules/thinkzap/domain/line-subscription'
import { OfferablePlanReader } from '@/modules/thinkzap/domain/ports/offerable-plan-reader.port'
import { planAmountForLines } from '@/modules/thinkzap/domain/plan-pricing'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

// Sem `gatewayId`: o price id não sai da aplicação.
export type LineSubscriptionPlan = {
  id: string
  name: string
  // Valor de cadastro, não o cobrado: nunca multiplicar por linhas (price escalonado).
  amount: number
  // Valor real com degraus do gateway; `null` se o preço não resolveu (não inventar número).
  chargedAmount: number | null
  interval: Plan['interval']
  // Rótulo da linha vem daqui, não do plano da assinatura (que descreve só um conector).
  provider?: PlanProvider
  lineCount: number
  // `quantity` do `line_item` no gateway; difere de `lineCount` quando há cortesia.
  billedCount: number
  compedCount: number
}

// `currentPeriodEnd` é dia de calendário em UTC: a tela formata em UTC ou cai no bug de D-1.
// Nenhuma credencial nem `gatewayId` sai aqui.
export type LineSubscriptionState =
  | { status: 'none' }
  | {
      status: Subscription['status']
      modality: SubscriptionModality
      isTrial: boolean
      currentPeriodStart: Date
      currentPeriodEnd: Date
      // Um item por conector cobrado; ausente sem leitura do gateway (`amount × lineCount` não bate com a fatura).
      plans?: LineSubscriptionPlan[]
      // `null` se algum plano ficou sem preço: total parcial passaria por completo.
      contractTotal?: number | null
      entitlement: LineEntitlement
      billingPortalAvailable: boolean
      canSubscribe: boolean
      // Espelha as guardas de `CreateAdditionalLine`; vem do servidor para não divergir.
      canCreateLine: boolean
    }

// Trial cobra 0; plano pago sem preço resolvido é `null` (0 diria que o cliente não paga).
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
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.plan_price_invalid',
      { app: 'payments', planId: plan.id, err: error },
      {
        msg: 'Valor do plano não pôde ser calculado — a tela mostra o plano sem valor',
      },
    )
    return null
  }
}

// Status, período e habilitação vêm da SPA; do gateway só quanto é cobrado e por quantas linhas.
export class GetLineSubscriptionState {
  // Readers tipados pelo port, nunca o adapter: `runtime-gateway-isolation.test.ts` reprova import do Stripe.
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly prices?: PlanPriceReader,
    private readonly gatewaySubscriptions?: GatewaySubscriptionReader,
    private readonly offerablePlans?: OfferablePlanReader,
  ) {}

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
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.subscription_read_failed',
        {
          app: 'payments',
          gatewaySubscriptionId: current.gatewayId,
          err: error,
        },
        {
          msg: 'Assinatura não pôde ser lida no gateway — a tela mostra só o período vigente',
        },
      )
      return null
    }
  }

  // Uma leitura por price distinto: dois conectores podem compartilhar o mesmo price.
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
          logThinkzapError(
            apiLogger,
            'thinkzap.gateway.price_read_failed',
            { app: 'payments', priceId, err: error },
            {
              msg: 'Preço não pôde ser lido no gateway — a tela mostra o plano sem valor',
            },
          )
        }
      }),
    )

    return byPriceId
  }

  // Método próprio para rodar em paralelo com a leitura da assinatura no gateway.
  private async composeAndPrice(
    contract: readonly { items: SubscriptionItem[] }[],
  ): Promise<{
    composition: ContractComposition<Plan> | null
    pricesByPriceId: Map<string, PlanPrice>
  }> {
    if (!this.offerablePlans) {
      return { composition: null, pricesByPriceId: new Map() }
    }

    const composition = composeContractByProvider(
      contract,
      await this.offerablePlans.listOfferable(),
    )

    return {
      composition,
      pricesByPriceId: await this.readPrices(
        composition.plans.map(entry => entry.plan),
      ),
    }
  }

  async execute(
    input: { domainId: string; appCode: string },
    now: Date = new Date(),
  ): Promise<LineSubscriptionState> {
    const context = await this.getAplicationContext.execute(input)

    // Irmãs com o mesmo `gatewayId` são um contrato só no gateway.
    const contract = resolveCurrentContract(context.subscriptions)
    const current = contract[0]
    if (!current) return { status: 'none' }

    const isTrial = isTrialSubscription(current)

    const [gatewaySubscription, { composition, pricesByPriceId }] =
      await Promise.all([
        this.readGatewaySubscription(current, isTrial),
        this.composeAndPrice(contract),
      ])

    // Sem leitura do gateway não há como separar cobrada de bonificada: omite a composição.
    const billing =
      gatewaySubscription && composition
        ? composeContractBilling(composition.plans, gatewaySubscription.items)
        : null

    // Leitura tolera conector sem plano único (total vira `null`); a cobrança (`buildContractLineItems`) recusa.
    for (const gap of composition?.unresolved ?? []) {
      logThinkzapError(
        apiLogger,
        gap.reason === 'ambiguous'
          ? 'thinkzap.subscription.plan_for_provider_ambiguous'
          : 'thinkzap.subscription.plan_for_provider_missing',
        {
          app: 'payments',
          provider: gap.provider,
          reason: gap.reason,
          planIds: gap.reason === 'ambiguous' ? gap.planIds : undefined,
        },
        {
          msg: 'Conector do contrato sem plano ofertável único — fora da composição, e o total sai desconhecido',
        },
      )
    }

    const plans = billing?.map(entry => ({
      id: entry.plan.id,
      name: entry.plan.name,
      amount: entry.plan.amount,
      // Sobre `billedCount`, não `lineCount`: linha bonificada não entra no preço.
      chargedAmount: resolveChargedAmount(
        entry.plan,
        entry.plan.gatewayId
          ? (pricesByPriceId.get(entry.plan.gatewayId) ?? null)
          : null,
        entry.billedCount,
      ),
      interval: entry.plan.interval,
      provider: entry.provider,
      lineCount: entry.lineCount,
      billedCount: entry.billedCount,
      compedCount: entry.compedCount,
    }))

    for (const entry of billing ?? []) {
      if (!entry.overBilled) continue

      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.quantity_divergence',
        {
          app: 'payments',
          planId: entry.plan.id,
          billedCount: entry.billedCount,
          lineCount: entry.lineCount,
        },
        {
          msg: 'Gateway cobra mais linhas do que a SPA tem ativas — divergência a reconciliar',
        },
      )
    }

    // Contado dos itens, não da composição: `canCreateLine` não pode depender do catálogo.
    const lineCount = [...countActiveLinesByProvider(contract).values()].reduce(
      (total, count) => total + count,
      0,
    )

    // Plano sem preço ou conector fora da composição → `null`: total parcial passaria por completo.
    const contractTotal = !plans
      ? undefined
      : (composition?.unresolved.length ?? 0) > 0 ||
          plans.some(plan => plan.chargedAmount === null)
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
      billingPortalAvailable:
        current.modality === 'stripe' &&
        !isTrial &&
        current.status !== 'cancelled',
      // Troca de plano fora de escopo: paga viva não recebe oferta.
      canSubscribe: isTrial || current.status === 'cancelled',
      // Trial lê `manual` (nasce sem o campo) mas pode criar linha; boleto não.
      canCreateLine:
        lineCount > 0 && (isTrial || current.modality === 'stripe'),
    }
  }
}
