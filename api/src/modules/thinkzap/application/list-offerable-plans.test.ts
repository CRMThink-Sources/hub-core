import { describe, expect, it, vi } from 'vitest'

import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { PlanPrice } from '@/modules/application/domain/entities/plan-price'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { apiLogger } from '@/shared/infra/logger'
import { ListOfferablePlans } from './list-offerable-plans'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/** Os degraus reais de produção. */
const WEB_PRICE: PlanPrice = {
  kind: 'tiered',
  currency: 'brl',
  recurrence: { interval: 'month', intervalCount: 1 },
  mode: 'graduated',
  tiers: [
    { upTo: 1, unitAmount: 28700 },
    { upTo: null, unitAmount: 18700 },
  ],
}

const BUSINESS_PRICE: PlanPrice = {
  ...WEB_PRICE,
  mode: 'volume',
  tiers: [
    { upTo: 1, unitAmount: 25700 },
    { upTo: null, unitAmount: 18700 },
  ],
}

const planWith = (overrides: Partial<Plan> & { id: string }): Plan => ({
  name: `Plano ${overrides.id}`,
  product: {
    id: '42',
    name: 'ThinkZap',
    billingModel: 'subscription',
    active: true,
  },
  amount: 28700,
  interval: 'monthly',
  active: true,
  ...overrides,
})

const WEB = planWith({
  id: '1',
  gatewayId: 'price_web',
  provider: 'ZAPI',
})

const BUSINESS = planWith({
  id: '5',
  gatewayId: 'price_biz',
  provider: 'HUBMESSAGE',
  amount: 25700,
})

const repositoryWith = (plans: Plan[]): PlanRepository => ({
  getPlan: vi.fn((id: string) =>
    Promise.resolve(plans.find(plan => plan.id === id)!),
  ),
  getPlans: vi.fn(() => Promise.resolve(plans)),
})

const PRICES: Record<string, PlanPrice> = {
  price_web: WEB_PRICE,
  price_biz: BUSINESS_PRICE,
}

/** Reader que responde pelos price ids dos fixtures, e falha nos outros. */
const readerFor = (prices: Record<string, PlanPrice> = PRICES) => ({
  readPrice: vi.fn((priceId: string) => {
    const price = prices[priceId]
    if (!price) return Promise.reject(new Error(`No such price: ${priceId}`))
    return Promise.resolve(price)
  }),
})

const listOf = (plans: Plan[], prices?: Record<string, PlanPrice>) =>
  new ListOfferablePlans(repositoryWith(plans), readerFor(prices))

const lines = (entries: Array<[PlanProvider, number]>) => new Map(entries)

describe('ListOfferablePlans.execute', () => {
  it('projeta o acréscimo marginal da primeira linha de cada conector', async () => {
    const result = await listOf([WEB, BUSINESS]).execute()

    expect(result).toEqual([
      expect.objectContaining({
        id: '1',
        provider: 'ZAPI',
        additionalLineAmount: 28700,
        totalAfterAdditionalLine: 28700,
        pricing: { kind: 'tiered', mode: 'graduated' },
      }),
      expect.objectContaining({
        id: '5',
        provider: 'HUBMESSAGE',
        additionalLineAmount: 25700,
        totalAfterAdditionalLine: 25700,
        pricing: { kind: 'tiered', mode: 'volume' },
      }),
    ])
  })

  /**
   * `graduated`: a linha nova paga o degrau dela. É a conta que a tela precisa mostrar
   * em vez do primeiro degrau, que é R$ 100,00 mais caro.
   */
  it('graduated: com uma linha existente, o acréscimo é o degrau seguinte', async () => {
    const [plan] = await listOf([WEB]).execute(lines([['ZAPI', 1]]))

    expect(plan).toMatchObject({
      additionalLineAmount: 18700,
      totalAfterAdditionalLine: 47400,
    })
  })

  /**
   * `volume`: as linhas que já existem passam a pagar o degrau novo, então o acréscimo
   * é menor que o degrau alcançado — e o total muda de patamar, o que a tela também
   * mostra.
   */
  it('volume: o acréscimo é a diferença do contrato inteiro', async () => {
    const [plan] = await listOf([BUSINESS]).execute(lines([['HUBMESSAGE', 1]]))

    expect(plan).toMatchObject({
      additionalLineAmount: 11700,
      totalAfterAdditionalLine: 37400,
    })
  })

  it('conta as linhas por conector, sem misturar os dois', async () => {
    const result = await listOf([WEB, BUSINESS]).execute(
      lines([
        ['ZAPI', 2],
        ['HUBMESSAGE', 0],
      ]),
    )

    expect(result[0]).toMatchObject({ additionalLineAmount: 18700 })
    expect(result[1]).toMatchObject({ additionalLineAmount: 25700 })
  })

  /** Sem preço não há oferta honesta: o plano sai da lista, com aviso. */
  it('esconde plano cujo preço não pôde ser lido no gateway', async () => {
    const semPreco = planWith({
      id: '9',
      gatewayId: 'price_inexistente',
      provider: 'ZAPI',
    })

    const result = await listOf([semPreco]).execute()

    expect(result).toEqual([])
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ planId: '9', priceId: 'price_inexistente' }),
      expect.stringContaining('não será oferecido'),
    )
  })

  /** Modo desconhecido faz o cálculo lançar; a resposta é esconder, não estimar. */
  it('esconde plano cujo modo de escalonamento não é calculável', async () => {
    const modoEstranho = planWith({
      id: '7',
      gatewayId: 'price_lunar',
      provider: 'ZAPI',
    })

    const result = await listOf([modoEstranho], {
      price_lunar: { ...WEB_PRICE, mode: 'lunar' } as unknown as PlanPrice,
    }).execute()

    expect(result).toEqual([])
  })

  /**
   * Sem gateway configurado não há preço a ler, e a tela fica sem oferta — que é o
   * estado honesto: sem gateway a contratação self-service não existe.
   */
  it('sem reader de preço, nada é ofertado', async () => {
    const result = await new ListOfferablePlans(repositoryWith([WEB])).execute()

    expect(result).toEqual([])
  })

  it('lê o preço uma vez por plano, pelo price id do plano', async () => {
    const reader = readerFor()

    await new ListOfferablePlans(
      repositoryWith([WEB, BUSINESS]),
      reader,
    ).execute()

    expect(reader.readPrice).toHaveBeenCalledTimes(2)
    expect(reader.readPrice).toHaveBeenCalledWith('price_web')
    expect(reader.readPrice).toHaveBeenCalledWith('price_biz')
  })

  it('a projeção não vaza price id nem degraus', async () => {
    const [plan] = await listOf([WEB]).execute()

    expect(plan).not.toHaveProperty('gatewayId')
    expect(plan).not.toHaveProperty('price')
    expect(JSON.stringify(plan)).not.toContain('price_web')
  })

  /**
   * `listOfferable` serve para **montar cobrança**, onde só price id e quantidade
   * importam — o gateway aplica os degraus. Exigir preço aqui faria criação de linha e
   * limpeza de item dependerem de uma leitura que elas não usam.
   */
  it('listOfferable não lê preço nenhum', async () => {
    const reader = readerFor()
    const semPreco = planWith({
      id: '9',
      gatewayId: 'price_inexistente',
      provider: 'ZAPI',
    })

    const plans = await new ListOfferablePlans(
      repositoryWith([semPreco]),
      reader,
    ).listOfferable()

    expect(plans).toHaveLength(1)
    expect(reader.readPrice).not.toHaveBeenCalled()
  })
})
