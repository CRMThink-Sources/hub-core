import { Product } from './product'

/**
 * Qual conector o plano precifica.
 *
 * Mesmo vocabulário de `SubscriptionItemMetadata.provider`, sem o `'NONE'`: um
 * plano precifica um conector real ou nenhum, e "nenhum" é a ausência do campo,
 * não um terceiro valor.
 */
export type PlanProvider = 'ZAPI' | 'HUBMESSAGE'

export interface Plan {
  id: string
  name: string
  product: Product
  /** Valor em centavos (4990 = R$ 49,90), como o `unit_amount` do Stripe. */
  amount: number
  interval: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
  /** Ausente enquanto o plano não foi espelhado no gateway de pagamento. */
  gatewayId?: string
  /**
   * Conector que este plano precifica. Ausente no plano de trial, que não
   * precifica nenhum.
   *
   * **Ausente num plano pago o torna não ofertável**, de propósito: sem saber o que
   * ele precifica não há como impedir que a linha errada o contrate, e o custo de
   * ofertar errado é cobrar menos do que o cliente consome. Falhar fechado esconde
   * o plano; falhar aberto perde dinheiro em silêncio.
   */
  provider?: PlanProvider
  active: boolean
}
