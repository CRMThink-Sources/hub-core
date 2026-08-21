import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import {
  PlanPrice,
  TieringMode,
} from '@/modules/application/domain/entities/plan-price'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import {
  planAmountForLines,
  planMarginalForNextLine,
} from '@/modules/thinkzap/domain/plan-pricing'
import { apiLogger } from '@/shared/infra/logger'

/** O plano como a tela de contratação precisa dele. */
export type OfferablePlan = {
  id: string
  name: string
  /**
   * Valor de cadastro do CRM, em centavos. **Não é o preço cobrado** — ver
   * `Plan.amount`. Continua na projeção porque é o rótulo do catálogo que a tela já
   * mostra em lista, mas nenhuma superfície deve multiplicá-lo por quantidade.
   */
  amount: number
  /**
   * Quanto a **próxima** linha deste conector acrescenta ao contrato, em centavos.
   *
   * É o número que a oferta de linha nova mostra. Marginal, e não o primeiro degrau:
   * em preço com desconto por volume o primeiro degrau é o mais caro, então anunciar
   * ele informa um acréscimo maior do que o cobrado.
   */
  additionalLineAmount: number
  /**
   * O total do contrato **daquele plano** depois de acrescentar a linha, em centavos.
   *
   * Vai junto porque em `volume` as linhas que já existem passam a pagar o degrau
   * novo: só o acréscimo esconderia que a fatura inteira muda de patamar.
   */
  totalAfterAdditionalLine: number
  /**
   * A forma do preço, para a tela saber se precisa explicar que o total das linhas
   * existentes também muda. Sem valor nem degrau: o cálculo fica no servidor.
   */
  pricing: { kind: 'unit' } | { kind: 'tiered'; mode: TieringMode }
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
  /**
   * @param prices Leitura do preço no gateway, para a projeção da tela. Opcional
   * porque as superfícies que **montam cobrança** — criar linha, limpar item — usam só
   * `listOfferable`/`findOfferable`, onde price id e quantidade bastam: quem aplica os
   * degraus é o gateway. Injetar o reader nelas pagaria uma leitura que não se usa, e
   * arrastaria o adapter do gateway para caminhos que não podem alcançá-lo.
   */
  constructor(
    private readonly plans: PlanRepository,
    private readonly prices?: PlanPriceReader,
  ) {}

  /**
   * A projeção da tela. Só planos com **preço resolvido**: é a superfície que exibe
   * valor, e plano sem preço lido do gateway não tem valor honesto a mostrar.
   *
   * `lineCountByProvider` são as linhas ativas que a instalação já tem de cada
   * conector, e existem para o acréscimo ser o **marginal**. Sem elas o valor
   * anunciado seria o primeiro degrau — o mais caro em preço com desconto por volume
   * —, e o cliente desistiria por um preço que não existe. Ausente é lido como
   * instalação sem linha nenhuma, que é o caso da primeira contratação.
   */
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

  /**
   * O preço do plano no gateway, ou `null` quando não há como obtê-lo.
   *
   * Sem reader configurado — gateway sem chave — nenhum plano tem preço, e a tela fica
   * sem oferta. É o estado honesto: sem gateway a contratação self-service não existe.
   */
  private async readPrice(plan: Plan): Promise<PlanPrice | null> {
    if (!this.prices || !plan.gatewayId) return null

    try {
      return await this.prices.readPrice(plan.gatewayId)
    } catch (error) {
      apiLogger.warn(
        {
          app: 'payments',
          planId: plan.id,
          priceId: plan.gatewayId,
          error,
        },
        'Preço não pôde ser lido no gateway — o plano não será oferecido',
      )
      return null
    }
  }

  /**
   * O plano com os valores calculados, ou `null` quando não há preço confiável.
   *
   * Recusa de modo desconhecido cai aqui: o cálculo lança em vez de estimar, e a
   * resposta é esconder o plano com um `warn` — exibir um número que ninguém definiu
   * apareceria na fatura do cliente.
   */
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
      apiLogger.warn(
        { app: 'payments', planId: plan.id, error },
        'Preço do plano não pôde ser calculado — o plano não será oferecido',
      )
      return null
    }
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

  /**
   * Os planos que **deveriam** ser ofertáveis mas podem estar sem price id: `active`
   * e com provider, sem o filtro de `gatewayId`.
   *
   * Serve só para explicar recusa. `offerablePlans` exclui o plano cujo price id está
   * vazio no ambiente do gateway em uso, e sem esta lista "conector sem plano
   * cadastrado" e "plano cadastrado sem price id neste ambiente" chegam idênticos a
   * quem monta a mensagem — sendo que um se corrige criando item na SPA e o outro
   * preenchendo um campo.
   *
   * **Não é usada para resolver plano nem para montar cobrança**, e o `gatewayId`
   * daqui não sai para nenhuma resposta: um plano desta lista pode não ter price id
   * nenhum.
   */
  async listForDiagnosis(): Promise<Plan[]> {
    const plans = await this.plans.getPlans()

    return plans.filter(plan => plan.active && plan.provider)
  }

  private isOfferable(plan: Plan): boolean {
    return Boolean(plan.active && plan.gatewayId && plan.provider)
  }
}
