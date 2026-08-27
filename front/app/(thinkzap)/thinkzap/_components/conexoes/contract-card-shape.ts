import type {
  ContractPlan,
  SubscriptionState,
} from '@/app/hooks/use-line-subscription'

/**
 * O que o card do contrato mostra.
 *
 * `ausente`: instalação sem contrato pago a comentar — sem assinatura, ou só com
 * trial. Quem fala do teste é o `TrialCard`, e dois cards sobre o mesmo estado se
 * contradiriam.
 *
 * `reduzida`: título, período vigente e selo de modalidade. É a forma de quem não tem
 * cobrança que a aplicação conheça — boleto, mantido por automação de fora — e a de
 * quando a leitura no gateway não veio.
 *
 * `completa`: acrescenta valor, composição por plano e portal de faturamento.
 */
export type ContractCardShape =
  | { kind: 'ausente' }
  | { kind: 'reduzida'; contract: PaidContract }
  | { kind: 'completa'; contract: PaidContract; plans: ContractPlan[] }

/**
 * A assinatura sem o caso "não existe".
 *
 * Vai junto da forma porque é o que faz o estreitamento sobreviver à função: sem
 * carregar o contrato aqui, o componente teria que repetir o `status === 'none'` só
 * para o compilador — e a regra de quando o card aparece passaria a viver em dois
 * lugares.
 */
export type PaidContract = Exclude<SubscriptionState, { status: 'none' }>

/**
 * Decide a forma a partir do estado da assinatura.
 *
 * Função separada do componente para ser testável sem montar React: a regra tem
 * quatro caminhos e um deles — a degradação por leitura falha — é o que impede a tela
 * de voltar a exibir número inventado. Enterrada num JSX, ninguém a cobre.
 *
 * **A presença de `plans` é o gate real**, não a modalidade sozinha. O servidor já
 * omite a composição para tudo que não é cobrança do gateway lida com sucesso, então
 * checar modalidade aqui além disso duplicaria a regra em dois lugares. A modalidade
 * entra só como segunda guarda, para api antigo — que mandava `plans` para boleto
 * também — não escapar pela forma completa.
 */
export function resolveContractCardShape(
  subscription: SubscriptionState,
): ContractCardShape {
  if (subscription.status === 'none') return { kind: 'ausente' }
  if (subscription.isTrial) return { kind: 'ausente' }

  const contract = subscription
  if (contract.modality !== 'stripe') return { kind: 'reduzida', contract }

  const plans = contract.plans
  if (!plans || plans.length === 0) return { kind: 'reduzida', contract }

  return { kind: 'completa', contract, plans }
}

/** Há bonificação a mencionar? Sem nenhuma, a palavra não aparece na tela. */
export function hasCompedLines(plans: readonly ContractPlan[]): boolean {
  return plans.some(plan => (plan.compedCount ?? 0) > 0)
}
