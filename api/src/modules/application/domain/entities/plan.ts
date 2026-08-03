import { Product } from './product'

export interface Plan {
  id: string
  name: string
  product: Product
  /** Valor em centavos (4990 = R$ 49,90), como o `unit_amount` do Stripe. */
  amount: number
  interval: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
  /** Ausente enquanto o plano não foi espelhado no gateway de pagamento. */
  gatewayId?: string
  active: boolean
}
