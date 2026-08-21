import { describe, expect, it } from 'vitest'

import {
  PlanPrice,
  PriceTiersMissingError,
  UnknownTieringModeError,
  planAmountForLines,
  planMarginalForNextLine,
} from './plan-pricing'

const RECURRENCE = { interval: 'month' as const, intervalCount: 1 }

/**
 * Os degraus são os de produção, conferidos com `yarn check:plans-vs-gateway` na
 * conta live: os números destes testes são os que o cliente paga.
 */
const WEB: PlanPrice = {
  kind: 'tiered',
  currency: 'brl',
  recurrence: RECURRENCE,
  mode: 'graduated',
  tiers: [
    { upTo: 1, unitAmount: 28700 },
    { upTo: null, unitAmount: 18700 },
  ],
}

const BUSINESS: PlanPrice = {
  kind: 'tiered',
  currency: 'brl',
  recurrence: RECURRENCE,
  mode: 'volume',
  tiers: [
    { upTo: 1, unitAmount: 25700 },
    { upTo: null, unitAmount: 18700 },
  ],
}

const UNIT: PlanPrice = {
  kind: 'unit',
  currency: 'brl',
  recurrence: RECURRENCE,
  unitAmount: 9900,
}

const amount = (price: PlanPrice, lines: number) =>
  planAmountForLines({ planId: '1', price, lines })

describe('planAmountForLines', () => {
  /**
   * `graduated`: cada unidade paga o degrau em que caiu. A multiplicação ingênua
   * daria 861,00 para três linhas — 200,00 a mais do que a fatura.
   */
  it('soma degrau por degrau no modo graduated (Web 287/187)', () => {
    expect(amount(WEB, 1)).toBe(28700)
    expect(amount(WEB, 2)).toBe(47400)
    expect(amount(WEB, 3)).toBe(66100)
  })

  /** `volume`: todas as unidades pagam o degrau alcançado. */
  it('aplica o degrau alcançado a todas as unidades no modo volume (Business 257/187)', () => {
    expect(amount(BUSINESS, 1)).toBe(25700)
    expect(amount(BUSINESS, 2)).toBe(37400)
    expect(amount(BUSINESS, 3)).toBe(56100)
  })

  it('uma linha cai no primeiro degrau nos dois modos', () => {
    expect(amount(WEB, 1)).toBe(WEB.kind === 'tiered' ? 28700 : 0)
    expect(amount(BUSINESS, 1)).toBe(25700)
  })

  it('valor único multiplica pela quantidade', () => {
    expect(amount(UNIT, 1)).toBe(9900)
    expect(amount(UNIT, 3)).toBe(29700)
  })

  /**
   * Zero linha não consulta degrau: o primeiro degrau responderia como se houvesse
   * uma linha, e o plano apareceria cobrando sem ter o que cobrar.
   */
  it.each([0, -1])('zero ou menos linha (%i) custa zero', lines => {
    expect(amount(WEB, lines)).toBe(0)
    expect(amount(BUSINESS, lines)).toBe(0)
    expect(amount(UNIT, lines)).toBe(0)
  })

  it('degrau intermediário conta capacidade acumulada, não tamanho', () => {
    const price: PlanPrice = {
      kind: 'tiered',
      currency: 'brl',
      recurrence: RECURRENCE,
      mode: 'graduated',
      tiers: [
        { upTo: 1, unitAmount: 30000 },
        { upTo: 3, unitAmount: 20000 },
        { upTo: null, unitAmount: 10000 },
      ],
    }

    // 1×300 + 2×200 = 700; e a quarta unidade cai no último degrau.
    expect(planAmountForLines({ planId: '1', price, lines: 3 })).toBe(70000)
    expect(planAmountForLines({ planId: '1', price, lines: 4 })).toBe(80000)
  })

  /**
   * Estimar valor para um modo desconhecido exibiria — ou cobraria — um número que
   * ninguém definiu. O plano fica fora dos ofertáveis, e o erro nomeia modo e plano.
   */
  it('recusa modo de escalonamento desconhecido, nomeando modo e plano', () => {
    const price = {
      ...WEB,
      mode: 'tiered_by_moon_phase',
    } as unknown as PlanPrice

    let thrown: UnknownTieringModeError | undefined
    try {
      planAmountForLines({ planId: '5', price, lines: 2 })
    } catch (error) {
      thrown = error as UnknownTieringModeError
    }

    expect(thrown).toBeInstanceOf(UnknownTieringModeError)
    expect(thrown?.message).toContain('tiered_by_moon_phase')
    expect(thrown?.message).toContain('"5"')
  })

  it('recusa price escalonado sem degrau, em vez de cobrar zero', () => {
    const price: PlanPrice = { ...WEB, tiers: [] }

    expect(() => planAmountForLines({ planId: '1', price, lines: 1 })).toThrow(
      PriceTiersMissingError,
    )
  })
})

describe('planMarginalForNextLine', () => {
  const marginal = (price: PlanPrice, currentLines: number) =>
    planMarginalForNextLine({ planId: '1', price, currentLines })

  /** Em `graduated` o marginal é o degrau da unidade nova. */
  it('graduated: a segunda linha custa o degrau seguinte', () => {
    expect(marginal(WEB, 1)).toBe(18700)
    expect(marginal(WEB, 2)).toBe(18700)
  })

  /**
   * Em `volume` o marginal é **menor** que o degrau alcançado, porque a linha que já
   * existe passa a pagar o degrau novo: 374,00 − 257,00 = 117,00. Anunciar 187,00
   * cobraria de menos na tela; anunciar 257,00 espantaria o cliente com um preço que
   * não existe.
   */
  it('volume: a segunda linha custa a diferença do contrato inteiro', () => {
    expect(marginal(BUSINESS, 1)).toBe(11700)
    expect(marginal(BUSINESS, 2)).toBe(18700)
  })

  it('a primeira linha paga do conector custa o primeiro degrau', () => {
    expect(marginal(WEB, 0)).toBe(28700)
    expect(marginal(BUSINESS, 0)).toBe(25700)
  })

  it('valor único tem marginal constante', () => {
    expect(marginal(UNIT, 0)).toBe(9900)
    expect(marginal(UNIT, 4)).toBe(9900)
  })

  it('contagem negativa é tratada como zero', () => {
    expect(marginal(WEB, -3)).toBe(28700)
  })

  it('propaga a recusa de modo desconhecido', () => {
    const price = { ...WEB, mode: 'weird' } as unknown as PlanPrice

    expect(() =>
      planMarginalForNextLine({ planId: '1', price, currentLines: 1 }),
    ).toThrow(UnknownTieringModeError)
  })
})
