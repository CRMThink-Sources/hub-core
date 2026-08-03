import { Aplication } from './aplication'
import { Plan } from './plan'

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
   * Não há `product` de propósito: a SPA 1142 não tem campo de produto — os
   * userfields dela são `UF_CRM_91_CLIENT`, `_STATUS`, `_CURRENT_PERIOD_START`,
   * `_CURRENT_PERIOD_END`, `_CANCELED_AT`, `_GATEWAY_ID` e `_PLAN`. O produto
   * cobrado é o do plano: `subscription.plan.product`.
   */
  gatewayId?: string
}
