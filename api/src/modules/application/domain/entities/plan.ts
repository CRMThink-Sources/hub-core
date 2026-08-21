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
  /**
   * Valor em centavos (4990 = R$ 49,90) **como cadastrado no CRM**.
   *
   * NÃO é o preço cobrado, e não deve ser usado para calcular, exibir ou conferir
   * cobrança. O preço vem do price do plano no gateway, que pode ser **escalonado** —
   * e nesse caso não existe valor unitário: multiplicar este campo pela contagem de
   * linhas dá um número maior do que a fatura. Quem responde por preço é
   * `plan-pricing.ts` (`PlanPrice`, `planAmountForLines`), a partir do que o gateway
   * declara.
   *
   * Fica porque é o que quem administra o catálogo enxerga na SPA, e porque o
   * diagnóstico o compara com o primeiro degrau para acusar cadastro divergente.
   */
  amount: number
  interval: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
  /**
   * Price id do plano **na conta do gateway em uso**.
   *
   * A SPA guarda um price id por ambiente — produção e homologação compartilham o
   * mesmo portal Bitrix e a mesma SPA de planos, mas contas Stripe distintas — e o
   * mapper resolve qual dos dois vem para cá a partir de
   * `env.payments.stripe.environment`. O domínio segue vendo **um** campo: dois
   * fariam cada consumidor de price id escolher ambiente, e a primeira escolha errada
   * é uma cobrança na conta errada.
   *
   * Ausente quando o plano não foi espelhado no gateway daquele ambiente. É o que
   * `isTrialSubscription` usa para dizer que a assinatura é de teste — plano sem
   * price id é grátis por construção —, então price id faltando por erro de cadastro
   * é indistinguível de trial aqui. Quem separa os dois é o aviso emitido na leitura
   * (`plan.mapper.ts`).
   */
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
