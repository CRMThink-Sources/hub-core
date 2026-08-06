import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectBitrixSpaPlanToRawPlan,
  mapBitrixSpaPlanToRawPlan,
} from './plan.mapper'
import { apiLogger } from '@/shared/infra/logger'
import { PLAN_PROVIDER_FIELD } from '../ensure-plan-provider-field'
import { InvalidBitrixPlanError } from '../errors/invalid-bitrix-plan.error'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const validItem = {
  id: 7,
  title: 'ThinkZap Pro',
  // Id nu: é o que o portal devolve num campo `crm` (confirmado na SPA 1138).
  ufCrm89Product: '42',
  ufCrm89Value: 4990,
  ufCrm89Interval: '13609',
  ufCrm89GatewayId: 'price_abc',
  ufCrm89Active: true,
  [PLAN_PROVIDER_FIELD]: 'ZAPI',
}

const itemWith = (overrides: Record<string, unknown>) => ({
  ...validItem,
  ...overrides,
})

beforeEach(() => {
  vi.mocked(apiLogger.warn).mockClear()
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
      provider: 'ZAPI',
      active: true,
    })
  })

  describe('provider', () => {
    it.each([['ZAPI'], ['HUBMESSAGE']])('lê o valor gravado (%s)', raw => {
      expect(
        mapBitrixSpaPlanToRawPlan(itemWith({ [PLAN_PROVIDER_FIELD]: raw }))
          .provider,
      ).toBe(raw)
    })

    /** Tolerante no caso do dedo: o CRM é digitado à mão. */
    it.each([['zapi'], [' hubmessage '], ['HubMessage']])(
      'normaliza caixa e espaço (%s)',
      raw => {
        expect(
          mapBitrixSpaPlanToRawPlan(itemWith({ [PLAN_PROVIDER_FIELD]: raw }))
            .provider,
        ).toMatch(/^(ZAPI|HUBMESSAGE)$/)
      },
    )

    /** O plano de trial: não precifica conector nenhum. */
    it.each([null, undefined, ''])(
      'resolve undefined quando vem vazio (%s), sem warning',
      raw => {
        expect(
          mapBitrixSpaPlanToRawPlan(itemWith({ [PLAN_PROVIDER_FIELD]: raw }))
            .provider,
        ).toBeUndefined()
        expect(apiLogger.warn).not.toHaveBeenCalled()
      },
    )

    it('resolve undefined quando a chave não existe no item', () => {
      const { [PLAN_PROVIDER_FIELD]: _omitted, ...beforeTheField } = validItem

      expect(mapBitrixSpaPlanToRawPlan(beforeTheField).provider).toBeUndefined()
      expect(apiLogger.warn).not.toHaveBeenCalled()
    })

    /**
     * Aí alguém digitou algo que o produto não entende. `warn`, porque o sintoma —
     * plano sumido do checkout — não aponta para a causa.
     */
    it.each([['OFICIAL'], ['13609'], ['whatsapp']])(
      'resolve undefined com warning para valor desconhecido (%s)',
      raw => {
        expect(
          mapBitrixSpaPlanToRawPlan(itemWith({ [PLAN_PROVIDER_FIELD]: raw }))
            .provider,
        ).toBeUndefined()
        expect(apiLogger.warn).toHaveBeenCalledTimes(1)
      },
    )

    /**
     * Reprovar o plano por causa deste campo derrubaria `getPlan`, e com ele a
     * leitura do contexto inteiro da instalação — lista de linhas incluída.
     */
    it('não reprova o item por causa do provider', () => {
      expect(() =>
        mapBitrixSpaPlanToRawPlan(itemWith({ [PLAN_PROVIDER_FIELD]: 'lixo' })),
      ).not.toThrow()
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
    it('lê o id nu que o campo `crm` devolve', () => {
      expect(mapBitrixSpaPlanToRawPlan(validItem).productId).toBe('42')
    })

    it('coage id numérico para string', () => {
      expect(
        mapBitrixSpaPlanToRawPlan(itemWith({ ufCrm89Product: 42 })).productId,
      ).toBe('42')
    })

    it.each([null, '', 0, '0'])(
      'rejeita referência ausente (%s)',
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
