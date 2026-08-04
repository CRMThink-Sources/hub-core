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
 * O conector que a instalação consome, para casar com o provider do plano.
 *
 * `'NONE'`: nenhuma linha com conector. Ausência de restrição — não há conector em
 * uso, então nenhum plano pode cobrar de menos por um.
 *
 * `'MIXED'`: linhas de providers diferentes na mesma instalação. **Não é
 * precificável hoje** e é tratado como tal, em vez de escolher um dos dois: uma
 * assinatura carrega um plano só, e `quantity` multiplica um preço só, então
 * qualquer escolha cobraria o preço de um provider pelo uso de dois. Alcançável só
 * quando criar linha adicional entrar (dívida 2), e nomeado desde já para o dia em
 * que for — o alternativo é o checkout cobrar errado sem ninguém perceber.
 */
export type LineProviderResolution = PlanProvider | 'NONE' | 'MIXED'

export function resolveLineProvider(
  subscriptions: readonly { items: SubscriptionItem[] }[],
): LineProviderResolution {
  const providers = new Set<PlanProvider>()

  for (const subscription of subscriptions) {
    for (const item of subscription.items) {
      // Linha cancelada não consome conector, então não restringe o plano.
      if (item.status !== 'active') continue
      if (item.metadata.provider === 'NONE') continue

      providers.add(item.metadata.provider)
    }
  }

  if (providers.size === 0) return 'NONE'
  if (providers.size > 1) return 'MIXED'

  return [...providers][0]!
}
