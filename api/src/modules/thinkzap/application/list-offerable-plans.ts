import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import {
  PlanPrice,
  TieringMode,
} from '@/modules/application/domain/entities/plan-price'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { OfferablePlanReader } from '@/modules/thinkzap/domain/ports/offerable-plan-reader.port'
import {
  planAmountForLines,
  planMarginalForNextLine,
} from '@/modules/thinkzap/domain/plan-pricing'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

export type OfferablePlan = {
  id: string
  name: string
  /** Rótulo de catálogo, não o preço cobrado: nunca multiplicar por quantidade. */
  amount: number
  /** Marginal da próxima linha, não o 1º degrau (o mais caro em desconto por volume). */
  additionalLineAmount: number
  /** Em `volume` as linhas existentes mudam de degrau; só o acréscimo esconderia isso. */
  totalAfterAdditionalLine: number
  pricing: { kind: 'unit' } | { kind: 'tiered'; mode: TieringMode }
  interval: Plan['interval']
  provider: PlanProvider
}

// Sem `provider` o plano some (falha fechada): aberto, linha Z-API pagaria o plano do Oficial.
// `gatewayId` nunca sai na resposta: price id vindo do corpo seria o cliente escolher quanto pagar.
export class ListOfferablePlans implements OfferablePlanReader {
  // `prices` é opcional: os fluxos de cobrança não leem preço, quem aplica degraus é o gateway.
  constructor(
    private readonly plans: PlanRepository,
    private readonly prices?: PlanPriceReader,
  ) {}

  // `lineCountByProvider` ausente = instalação sem linhas (primeira contratação).
  async execute(
    lineCountByProvider?: ReadonlyMap<PlanProvider, number>,
  ): Promise<OfferablePlan[]> {
    const plans = await this.listOfferable()

    const projected = await Promise.all(
      plans.map(async plan =>
        this.projectPriced(
          plan,
          await this.readPrice(plan),
          lineCountByProvider,
        ),
      ),
    )

    return projected.filter((plan): plan is OfferablePlan => plan !== null)
  }

  private async readPrice(plan: Plan): Promise<PlanPrice | null> {
    if (!this.prices || !plan.gatewayId) return null

    try {
      return await this.prices.readPrice(plan.gatewayId)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.price_read_failed',
        {
          app: 'payments',
          planId: plan.id,
          priceId: plan.gatewayId,
          err: error,
        },
        {
          msg: 'Preço não pôde ser lido no gateway — o plano não será oferecido',
        },
      )
      return null
    }
  }

  // Modo de preço desconhecido lança no cálculo: esconde o plano em vez de estimar valor.
  private projectPriced(
    plan: Plan,
    price: PlanPrice | null,
    lineCountByProvider?: ReadonlyMap<PlanProvider, number>,
  ): OfferablePlan | null {
    if (!price) return null

    const provider = plan.provider!
    const currentLines = lineCountByProvider?.get(provider) ?? 0

    try {
      return {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval,
        provider,
        additionalLineAmount: planMarginalForNextLine({
          planId: plan.id,
          price,
          currentLines,
        }),
        totalAfterAdditionalLine: planAmountForLines({
          planId: plan.id,
          price,
          lines: currentLines + 1,
        }),
        pricing:
          price.kind === 'tiered'
            ? { kind: 'tiered', mode: price.mode }
            : { kind: 'unit' },
      }
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.plan_price_invalid',
        { app: 'payments', planId: plan.id, err: error },
        {
          msg: 'Preço do plano não pôde ser calculado — o plano não será oferecido',
        },
      )
      return null
    }
  }

  // Uso interno (traz `gatewayId`); nunca expor em rota.
  async listOfferable(): Promise<Plan[]> {
    const plans = await this.plans.getPlans()

    return plans.filter(plan => this.isOfferable(plan))
  }

  // Mesmo predicado da listagem; `provider` é o da linha cobrada, não o da instalação.
  async findOfferable(
    planId: string,
    provider: PlanProvider,
  ): Promise<Plan | null> {
    const plans = await this.plans.getPlans()

    return (
      plans.find(
        plan =>
          plan.id === planId &&
          this.isOfferable(plan) &&
          plan.provider === provider,
      ) ?? null
    )
  }

  // Só para explicar recusa (plano sem price id); nunca para resolver plano ou cobrar.
  async listForDiagnosis(): Promise<Plan[]> {
    const plans = await this.plans.getPlans()

    return plans.filter(plan => plan.active && plan.provider)
  }

  private isOfferable(plan: Plan): boolean {
    return Boolean(plan.active && plan.gatewayId && plan.provider)
  }
}
