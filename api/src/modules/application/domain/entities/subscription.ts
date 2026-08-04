import { Aplication } from './aplication'
import { Plan } from './plan'

/**
 * Como a assinatura é cobrada — não **se** ela vale.
 *
 * `stripe`: self-service, com checkout, webhook e portal de faturamento.
 * `manual`: boleto, mantida por automação fora do produto, que escreve direto
 * nas SPAs. A aplicação lê e obedece.
 *
 * **Nenhum caminho de decisão de habilitação consulta este campo.**
 * `resolveLineEntitlement` decide por `status` e janela; a modalidade só governa
 * o que a tela oferece e quem dispara ciclo de cobrança no provider.
 */
export type SubscriptionModality = 'stripe' | 'manual'

export interface Subscription {
  id: string
  name: string
  plan: Plan
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  /**
   * Instalação que esta assinatura paga, hidratada. O cliente chega por
   * `aplication.customer`, sem leitura adicional.
   */
  aplication: Aplication
  /**
   * Sempre resolvida, **nunca** `undefined`: campo ausente, vazio ou com valor
   * desconhecido na SPA resolve `manual`. O default conservador é "não sabemos
   * gerenciar isso" — oferecer portal do gateway para assinatura que não é dele
   * daria erro na cara do cliente, e não oferecer é só uma ação a menos.
   */
  modality: SubscriptionModality
  /**
   * Não há `product` de propósito: a SPA 1142 não tem campo de produto — os
   * userfields dela são `UF_CRM_91_CLIENT`, `_STATUS`, `_CURRENT_PERIOD_START`,
   * `_CURRENT_PERIOD_END`, `_CANCELED_AT`, `_GATEWAY_ID` e `_PLAN`. O produto
   * cobrado é o do plano: `subscription.plan.product`.
   */
  gatewayId?: string
}
