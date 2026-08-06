import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'

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
 * Os planos que podem ser contratados: `active`, com id no gateway, **e** com
 * provider declarado.
 *
 * Três filtros, três motivos distintos:
 *
 * - **`active`**: plano fora de catálogo não se contrata.
 * - **`gatewayId`**: plano sem price id não tem o que cobrar; ofertá-lo levaria a um
 *   checkout que falha **depois** de o cliente escolher. É também o que separa o
 *   plano de trial (grátis) dos pagos, sem precisar de uma flag "é trial".
 * - **`provider`**: sem saber o que o plano precifica não há como impedir a linha
 *   errada de contratá-lo. Falhar fechado esconde o plano — visível em
 *   `yarn list:payment-plans`; falhar aberto perde dinheiro sem sintoma.
 *
 * **A listagem não é filtrada pelo conector que a instalação consome.** Era, e
 * deixou de ser: com um `line_item` por plano na assinatura do gateway, uma
 * instalação com os dois conectores é precificável, e esconder metade do catálogo
 * dela impediria justamente o caso que criar linha adicional existe para atender.
 *
 * O casamento entre plano e conector continua existindo, e é verificado **por
 * linha** — `findOfferable(planId, provider)` no ato da contratação ou da criação.
 * Sem isso, uma linha Z-API contrataria o plano do Oficial e pagaria menos do que
 * consome, em silêncio.
 *
 * **O `gatewayId` não sai daqui.** A tela manda o id do plano no checkout, e o
 * price id é resolvido no servidor — se viesse na resposta, mandar outro no corpo
 * seria escolher quanto pagar.
 */
export class ListOfferablePlans {
  constructor(private readonly plans: PlanRepository) {}

  async execute(): Promise<OfferablePlan[]> {
    const plans = await this.listOfferable()

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      amount: plan.amount,
      interval: plan.interval,
      provider: plan.provider!,
    }))
  }

  /**
   * Os mesmos planos, como **entidades** — com `gatewayId`.
   *
   * Existe porque o servidor precisa do price id para montar a cobrança, e a tela
   * não: `execute` é a projeção que sai na resposta, e esta é a que fica dentro. Duas
   * leituras do mesmo predicado, e não dois predicados — `isOfferable` é o único.
   *
   * **Não é exposta por nenhuma rota.** O dia em que for, mandar outro price id no
   * corpo passa a ser escolher quanto pagar.
   */
  async listOfferable(): Promise<Plan[]> {
    const plans = await this.plans.getPlans()

    return plans.filter(plan => this.isOfferable(plan))
  }

  /**
   * O plano ofertável de um id, ou `null`.
   *
   * Passa pelo **mesmo** predicado da listagem de propósito: um id que a tela não
   * poderia ter oferecido não pode ser contratado por corpo montado à mão. Duas
   * regras separadas divergiriam, e a divergência abriria exatamente o caminho que
   * o filtro fecha.
   *
   * `provider` é o conector da **linha** que vai ser cobrada por este plano, e não
   * o da instalação: é o que impede contratar o plano do conector errado agora que
   * uma instalação pode ter os dois.
   */
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

  private isOfferable(plan: Plan): boolean {
    return Boolean(plan.active && plan.gatewayId && plan.provider)
  }
}
