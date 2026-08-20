import type { PlanProvider } from '@/modules/application/domain/entities/plan'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

/**
 * Regras da assinatura de linha, puras.
 *
 * Mesma postura de `connector-trial`: nada aqui toca Prisma, Bitrix, Redis ou
 * gateway de pagamento. Estas funções decidem sobre dado que o chamador já tem em
 * mãos, e é isso que mantém a decisão fora da latência de terceiros.
 */

/**
 * Precedência de qual assinatura é a **vigente** de uma instalação.
 *
 * Uma instalação pode ter mais de uma — é o estado normal depois de contratar:
 * o trial fica `cancelled` e a paga fica `active`. A ordem responde "qual delas a
 * tela está falando sobre", e é deliberadamente do estado mais vivo para o mais
 * morto: uma paga inadimplente é mais relevante que um trial encerrado.
 */
const STATUS_PRECEDENCE: Record<Subscription['status'], number> = {
  active: 0,
  past_due: 1,
  trialing: 2,
  cancelled: 3,
}

/**
 * A assinatura vigente da instalação, ou `null` quando não há nenhuma.
 *
 * Empate de status é desempatado pelo fim de período mais recente — entre dois
 * trials encerrados, o que interessa é o último. Sem o desempate a resposta
 * dependeria da ordem em que o CRM devolveu os itens, que é ordem de criação e
 * não significa nada aqui.
 *
 * **Não** consulta modalidade: a pergunta é qual assinatura governa a linha, e
 * boleto governa igual.
 */
export function resolveCurrentSubscription<T extends Subscription>(
  subscriptions: readonly T[],
): T | null {
  if (subscriptions.length === 0) return null

  return [...subscriptions].sort((a, b) => {
    const byStatus = STATUS_PRECEDENCE[a.status] - STATUS_PRECEDENCE[b.status]
    if (byStatus !== 0) return byStatus

    return b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime()
  })[0]!
}

/**
 * `true` quando a assinatura é de teste.
 *
 * Derivado do plano **não ter** id no gateway, não do status: um trial encerrado
 * fica `cancelled`, indistinguível de uma paga cancelada pelo status. Plano sem
 * price id é grátis por construção — é o que separa trial de pago sem precisar de
 * uma flag "é trial" (decisão 8 do design).
 */
export function isTrialSubscription(
  subscription: Pick<Subscription, 'plan'>,
): boolean {
  return !subscription.plan.gatewayId
}

/**
 * O **contrato** vigente da instalação: as assinaturas que compartilham o mesmo id
 * no gateway.
 *
 * Uma instalação cobrada por dois planos tem uma assinatura por plano na SPA, as
 * duas com o mesmo `gatewayId` — é o que mantém `Subscription.plan` descrevendo
 * honestamente a cobrança do grupo de linhas dela. A vigente vem primeiro na
 * lista, para quem só precisa de status e período não escolher entre irmãs
 * equivalentes.
 *
 * Assinatura sem `gatewayId` (o trial, e a de boleto sem espelho) é contrato de uma
 * só: sem id no gateway não há o que agrupar, e agrupar por ausência juntaria dois
 * trials de instalações diferentes.
 */
export function resolveCurrentContract<T extends Subscription>(
  subscriptions: readonly T[],
): T[] {
  const primary = resolveCurrentSubscription(subscriptions)
  if (!primary) return []
  if (!primary.gatewayId) return [primary]

  return [
    primary,
    ...subscriptions.filter(
      subscription =>
        subscription.id !== primary.id &&
        subscription.gatewayId === primary.gatewayId,
    ),
  ]
}

/** Um plano do contrato e quantas linhas ele cobra. */
export type ContractPlanLines<T extends Subscription = Subscription> = {
  subscription: T
  plan: T['plan']
  /** Linhas ativas cobradas por este plano. É o `quantity` do `line_item`. */
  lineCount: number
}

/**
 * A composição do contrato por plano, na ordem em que as assinaturas vieram.
 *
 * A tela soma os valores daqui em vez de ler um plano só: com dois planos no mesmo
 * contrato, mostrar um deles reportaria menos do que o cliente paga.
 */
export function composeContractByPlan<
  T extends Subscription & { items: SubscriptionItem[] },
>(contract: readonly T[]): ContractPlanLines<T>[] {
  return contract.map(subscription => ({
    subscription,
    plan: subscription.plan,
    lineCount: subscription.items.filter(item => item.status === 'active')
      .length,
  }))
}

/**
 * Quantas linhas ativas de cada conector a instalação tem.
 *
 * É o que monta o estado desejado dos `line_items`: um `line_item` por plano, com
 * `quantity` igual à contagem do conector que aquele plano precifica. Linha
 * cancelada não conta — não é serviço prestado — e item de cobrança sem conector
 * (`provider: 'NONE'`) também não, porque não é linha.
 */
export function countActiveLinesByProvider(
  subscriptions: readonly { items: SubscriptionItem[] }[],
): Map<PlanProvider, number> {
  const counts = new Map<PlanProvider, number>()

  for (const subscription of subscriptions) {
    for (const item of subscription.items) {
      if (item.status !== 'active') continue
      if (item.metadata.provider === 'NONE') continue

      const provider = item.metadata.provider
      counts.set(provider, (counts.get(provider) ?? 0) + 1)
    }
  }

  return counts
}

/**
 * O plano que precifica um conector, ou o motivo de não haver um.
 *
 * Os dois motivos são **estados nomeados**, e não `null`, porque significam coisas
 * diferentes para quem chama: `missing` é configuração faltando na SPA de planos, e
 * `ambiguous` é decisão que o produto não pode tomar sozinho — escolher entre dois
 * planos do mesmo conector cobraria o preço de um pelo uso do outro, em silêncio.
 */
export type PlanForProvider<T> =
  | { kind: 'resolved'; plan: T }
  | { kind: 'missing'; provider: PlanProvider }
  | { kind: 'ambiguous'; provider: PlanProvider; planIds: string[] }

export function resolvePlanForProvider<
  T extends { id: string; provider?: PlanProvider },
>(offerablePlans: readonly T[], provider: PlanProvider): PlanForProvider<T> {
  const candidates = offerablePlans.filter(plan => plan.provider === provider)

  if (candidates.length === 0) return { kind: 'missing', provider }
  if (candidates.length > 1) {
    return {
      kind: 'ambiguous',
      provider,
      planIds: candidates.map(plan => plan.id),
    }
  }

  return { kind: 'resolved', plan: candidates[0]! }
}
