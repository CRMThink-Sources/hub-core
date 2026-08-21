/**
 * O preço de um plano como o **gateway** o define.
 *
 * Vive junto de `Plan`, e não no módulo que calcula, porque é parte do plano: se o
 * tipo morasse em `thinkzap`, a entidade de `application` passaria a depender de um
 * módulo de cima. A **conta** que estes degraus implicam fica em
 * `thinkzap/domain/plan-pricing.ts` — aqui é só a forma.
 *
 * O vocabulário é nosso, não do gateway: `billing_scheme` e `tiers_mode` são termos
 * do Stripe e ficam no adapter, senão trocar de gateway reescreveria a regra de
 * preço.
 */

/** Ciclo de cobrança do price, como o gateway o declara. */
export type PriceRecurrence = {
  interval: 'day' | 'week' | 'month' | 'year'
  intervalCount: number
}

/**
 * Um degrau de preço.
 *
 * `upTo: null` é o último degrau, o sem limite superior — a mesma forma que o
 * gateway usa, para não existir um segundo jeito de dizer "daqui para cima".
 *
 * `upTo` é **acumulado**, não o tamanho do degrau: um "até 3" depois de um "até 1"
 * cobre 2 unidades.
 */
export type PriceTier = {
  upTo: number | null
  /** Centavos por unidade **naquele** degrau. */
  unitAmount: number
}

/**
 * Como os degraus se aplicam.
 *
 * `graduated`: cada unidade paga o degrau em que ela cai. 3 linhas sob 287/187 =
 * 287 + 187 + 187 = 661.
 *
 * `volume`: **todas** as unidades pagam o degrau alcançado pela quantidade total.
 * 3 linhas sob 257/187 = 3 × 187 = 561.
 *
 * Os dois coexistem no mesmo contrato — hoje o WhatsApp Web é `graduated` e o
 * Business é `volume` —, então o modo é resolvido por plano, nunca uma vez para o
 * contrato.
 */
export type TieringMode = 'graduated' | 'volume'

/**
 * O preço de um plano, nas duas formas que o gateway admite.
 *
 * São **casos explícitos** e não um valor com uma lista opcional ao lado: com dois
 * campos onde um às vezes não vale nada, alguém lê o errado — e o errado seria o
 * valor unitário, que é justamente o que já estava espalhado pelo código.
 */
export type PlanPrice =
  | {
      kind: 'unit'
      currency: string
      recurrence: PriceRecurrence
      /** Centavos por unidade, para qualquer quantidade. */
      unitAmount: number
    }
  | {
      kind: 'tiered'
      currency: string
      recurrence: PriceRecurrence
      mode: TieringMode
      /** Na ordem do gateway: do primeiro degrau ao sem limite superior. */
      tiers: PriceTier[]
    }
