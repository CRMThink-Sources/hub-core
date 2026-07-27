import { describe, expect, it } from 'vitest'
import {
  collectBitrixSpaPlanToRawPlan,
  mapBitrixSpaPlanToRawPlan,
} from './plan.mapper'
import { InvalidBitrixPlanError } from '../errors/invalid-bitrix-plan.error'

const validItem = {
  id: 7,
  title: 'ThinkZap Pro',
  ufCrm89Product: '1134_42',
  ufCrm89Value: 4990,
  ufCrm89Interval: '13609',
  ufCrm89GatewayId: 'price_abc',
  ufCrm89Active: true,
}

const itemWith = (overrides: Record<string, unknown>) => ({
  ...validItem,
  ...overrides,
})

describe('mapBitrixSpaPlanToRawPlan', () => {
  it('mapeia um item válido da SPA', () => {
    expect(mapBitrixSpaPlanToRawPlan(validItem)).toEqual({
      id: '7',
      name: 'ThinkZap Pro',
      productId: '42',
      amount: 4990,
      interval: 'monthly',
      gatewayId: 'price_abc',
      active: true,
    })
  })

  describe('intervalo de cobrança', () => {
    it.each([
      ['13609', 'monthly'],
      ['13611', 'quarterly'],
      ['13613', 'semiannual'],
      ['13615', 'yearly'],
    ])('traduz o ID de enum %s para %s', (bitrixId, expected) => {
      const plan = mapBitrixSpaPlanToRawPlan(
        itemWith({ ufCrm89Interval: bitrixId }),
      )

      expect(plan.interval).toBe(expected)
    })

    it('aceita o ID de enum como número', () => {
      const plan = mapBitrixSpaPlanToRawPlan(
        itemWith({ ufCrm89Interval: 13615 }),
      )

      expect(plan.interval).toBe('yearly')
    })

    it('rejeita ID de enum desconhecido em vez de assumir um default', () => {
      expect(() =>
        mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Interval: '99999' })),
      ).toThrow(InvalidBitrixPlanError)
    })

    it('rejeita intervalo ausente', () => {
      expect(() =>
        mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Interval: null })),
      ).toThrow(InvalidBitrixPlanError)
    })
  })

  describe('referência ao produto', () => {
    it('extrai o id do formato "<entityTypeId>_<id>"', () => {
      expect(mapBitrixSpaPlanToRawPlan(validItem).productId).toBe('42')
    })

    it('rejeita referência apontando para outra entidade', () => {
      expect(() =>
        mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Product: '1140_42' })),
      ).toThrow(InvalidBitrixPlanError)
    })

    it.each([null, '', '42'])(
      'rejeita referência malformada (%s)',
      reference => {
        expect(() =>
          mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Product: reference })),
        ).toThrow(InvalidBitrixPlanError)
      },
    )
  })

  describe('campo ativo', () => {
    it.each([
      [true, true],
      ['Y', true],
      [false, false],
      ['N', false],
      [null, false],
    ])('trata %s como %s', (raw, expected) => {
      const plan = mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Active: raw }))

      expect(plan.active).toBe(expected)
    })
  })

  describe('valor', () => {
    it('coage string de centavos para número', () => {
      const plan = mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Value: '4990' }))

      expect(plan.amount).toBe(4990)
    })

    it('rejeita decimal — o campo é integer e guarda centavos', () => {
      // '49.90' seria R$ 0,49 se aceito como centavos: cadastro errado,
      // não arredondamento.
      expect(() =>
        mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Value: '49.90' })),
      ).toThrow(InvalidBitrixPlanError)
    })

    it.each([null, '', 'grátis', -1])(
      'rejeita valor inválido (%s) em vez de tratar como grátis',
      value => {
        expect(() =>
          mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Value: value })),
        ).toThrow(InvalidBitrixPlanError)
      },
    )
  })

  describe('gatewayId', () => {
    it.each([null, undefined, ''])(
      'trata ausência (%s) como undefined, não como erro',
      raw => {
        const plan = mapBitrixSpaPlanToRawPlan(
          itemWith({ ufCrm89GatewayId: raw }),
        )

        expect(plan.gatewayId).toBeUndefined()
      },
    )

    it('preserva o id quando o plano já está espelhado no gateway', () => {
      expect(mapBitrixSpaPlanToRawPlan(validItem).gatewayId).toBe('price_abc')
    })
  })

  it('lista os campos com problema na mensagem do erro', () => {
    let thrown: InvalidBitrixPlanError | undefined

    try {
      mapBitrixSpaPlanToRawPlan({ id: 7 })
    } catch (error) {
      thrown = error as InvalidBitrixPlanError
    }

    expect(thrown).toBeInstanceOf(InvalidBitrixPlanError)
    expect(thrown?.issues.map(issue => issue.path.join('.'))).toContain('title')
    expect(thrown?.message).toContain('title')
  })
})

describe('collectBitrixSpaPlanToRawPlan', () => {
  it('mapeia a coleção inteira', () => {
    const plans = collectBitrixSpaPlanToRawPlan([
      validItem,
      itemWith({ id: 8, ufCrm89Interval: '13615' }),
    ])

    expect(plans.map(plan => plan.id)).toEqual(['7', '8'])
    expect(plans.map(plan => plan.interval)).toEqual(['monthly', 'yearly'])
  })

  it('devolve lista vazia para entrada vazia', () => {
    expect(collectBitrixSpaPlanToRawPlan([])).toEqual([])
  })
})
