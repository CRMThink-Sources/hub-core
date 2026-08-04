import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { LineProviderResolution } from '@/modules/thinkzap/domain/line-subscription'

/** O plano como a tela de contratação precisa dele. */
export type OfferablePlan = {
  id: string
  name: string
  /** Centavos, como o `unit_amount` do gateway. A tela formata. */
  amount: number
  interval: Plan['interval']
  /**
   * Conector que o plano precifica. Vai para a tela porque com dois planos na
   * lista o cliente precisa ler qual é qual — os nomes no CRM são livres e não
   * garantem isso.
   */
  provider: PlanProvider
}

/**
 * Os planos que podem ser contratados: `active`, com id no gateway, **e** com o
 * provider que a linha da instalação consome.
 *
 * Três filtros, três motivos distintos:
 *
 * - **`active`**: plano fora de catálogo não se contrata.
 * - **`gatewayId`**: plano sem price id não tem o que cobrar; ofertá-lo levaria a um
 *   checkout que falha **depois** de o cliente escolher. É também o que separa o
 *   plano de trial (grátis) dos pagos, sem precisar de uma flag "é trial".
 * - **`provider`**: conector oficial e não oficial custam diferente. Sem este filtro
 *   uma linha Z-API poderia contratar o plano do Oficial e pagar menos do que
 *   consome — em silêncio, porque nada mais na cadeia compara os dois.
 *
 * Plano pago **sem** provider é não ofertável, de propósito: sem saber o que ele
 * precifica não há como impedir a linha errada de contratá-lo. Falhar fechado
 * esconde o plano — visível em `yarn list:payment-plans`; falhar aberto perde
 * dinheiro sem sintoma.
 *
 * **O `gatewayId` não sai daqui.** A tela manda o id do plano no checkout, e o
 * price id é resolvido no servidor — se viesse na resposta, mandar outro no corpo
 * seria escolher quanto pagar.
 */
export class ListOfferablePlans {
  constructor(private readonly plans: PlanRepository) {}

  async execute(
    lineProvider: LineProviderResolution,
  ): Promise<OfferablePlan[]> {
    const plans = await this.plans.getPlans()

    return plans
      .filter(plan => this.isOfferable(plan, lineProvider))
      .map(plan => ({
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval,
        provider: plan.provider!,
      }))
  }

  /**
   * O plano ofertável de um id, ou `null`.
   *
   * Passa pelo **mesmo** predicado da listagem de propósito: um id que a tela não
   * poderia ter oferecido não pode ser contratado por corpo montado à mão. Duas
   * regras separadas divergiriam, e a divergência abriria exatamente o caminho que
   * o filtro fecha.
   */
  async findOfferable(
    planId: string,
    lineProvider: LineProviderResolution,
  ): Promise<Plan | null> {
    const plans = await this.plans.getPlans()

    return (
      plans.find(
        plan => plan.id === planId && this.isOfferable(plan, lineProvider),
      ) ?? null
    )
  }

  private isOfferable(
    plan: Plan,
    lineProvider: LineProviderResolution,
  ): boolean {
    if (!plan.active || !plan.gatewayId || !plan.provider) return false

    /**
     * Providers misturados: nada é ofertável. Uma assinatura carrega um plano só, e
     * `quantity` multiplica um preço só — qualquer escolha cobraria o preço de um
     * provider pelo uso de dois.
     */
    if (lineProvider === 'MIXED') return false

    // Sem linha não há provider a respeitar: ofertar tudo não cobra de menos por
    // conector nenhum, porque não há conector em uso.
    return lineProvider === 'NONE' || plan.provider === lineProvider
  }
}
