import { describe, expect, it } from 'vitest'
import {
  APLICATION_PARENT_FIELD,
  collectBitrixSpaSubscriptionToRawSubscription,
  mapBitrixSpaSubscriptionToRawSubscription,
  mapSubscriptionInputToBitrixFields,
} from './subscription.mapper'
import { InvalidBitrixSubscriptionError } from '../errors/invalid-bitrix-subscription.error'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { CreateSubscriptionInput } from '@/modules/application/domain/repositories/subscription.repository'

const validItem = {
  id: 21,
  title: 'ThinkZap Pro — Acme',
  ufCrm91Plan: '7',
  [APLICATION_PARENT_FIELD]: 512,
  ufCrm91Status: '13617',
  ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00+03:00',
  ufCrm91CurrentPeriodEnd: '2026-08-01T00:00:00+03:00',
  ufCrm91GatewayId: 'sub_abc',
}

const itemWith = (overrides: Record<string, unknown>) => ({
  ...validItem,
  ...overrides,
})

describe('mapBitrixSpaSubscriptionToRawSubscription', () => {
  it('mapeia um item válido da SPA', () => {
    expect(mapBitrixSpaSubscriptionToRawSubscription(validItem)).toEqual({
      id: '21',
      name: 'ThinkZap Pro — Acme',
      planId: '7',
      aplicationSpaId: '512',
      status: 'active',
      currentPeriodStart: new Date('2026-07-01T00:00:00+03:00'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00+03:00'),
      gatewayId: 'sub_abc',
    })
  })

  describe('status', () => {
    it.each([
      ['13617', 'active'],
      ['13619', 'trialing'],
      ['13621', 'past_due'],
      ['13623', 'cancelled'],
    ])('traduz o ID de enum %s para %s', (bitrixId, expected) => {
      const subscription = mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({ ufCrm91Status: bitrixId }),
      )

      expect(subscription.status).toBe(expected)
    })

    it('aceita o ID de enum como número', () => {
      expect(
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ ufCrm91Status: 13623 }),
        ).status,
      ).toBe('cancelled')
    })

    it.each([['99999'], [null], ['']])(
      'rejeita status inválido (%s) em vez de assumir um default',
      status => {
        expect(() =>
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ ufCrm91Status: status }),
          ),
        ).toThrow(InvalidBitrixSubscriptionError)
      },
    )

    it('rejeita status ausente', () => {
      const { ufCrm91Status: _omitted, ...withoutStatus } = validItem

      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(withoutStatus),
      ).toThrow(InvalidBitrixSubscriptionError)
    })
  })

  describe('vínculo com o plano', () => {
    it('lê o id cru, sem prefixo de entidade', () => {
      expect(
        mapBitrixSpaSubscriptionToRawSubscription(itemWith({ ufCrm91Plan: 7 }))
          .planId,
      ).toBe('7')
    })

    it.each([null, '', 0])('rejeita vínculo inválido (%s)', reference => {
      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ ufCrm91Plan: reference }),
        ),
      ).toThrow(InvalidBitrixSubscriptionError)
    })
  })

  describe('vínculo com o produto', () => {
    it('não lê campo de produto da SPA', () => {
      // A SPA 1142 não tem `UF_CRM_91_PRODUCT`; o produto cobrado é o do plano.
      // Um item com o campo mapeia igual a um sem ele.
      expect(
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ ufCrm91Product: '42' }),
        ),
      ).toEqual(mapBitrixSpaSubscriptionToRawSubscription(validItem))
    })

    it('não emite campo de produto na escrita', () => {
      expect(
        mapSubscriptionInputToBitrixFields({ planId: '7' }),
      ).not.toHaveProperty('ufCrm91Product')
    })
  })

  describe('vínculo com a aplicação', () => {
    it('coage o parent numérico para string', () => {
      expect(
        mapBitrixSpaSubscriptionToRawSubscription(validItem).aplicationSpaId,
      ).toBe('512')
    })

    it.each([null, '', 0])('rejeita parent inválido (%s)', reference => {
      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ [APLICATION_PARENT_FIELD]: reference }),
        ),
      ).toThrow(InvalidBitrixSubscriptionError)
    })
  })

  describe('período', () => {
    it.each([null, '', 'ontem'])(
      'rejeita data inválida (%s) em vez de devolver epoch ou Invalid Date',
      value => {
        expect(() =>
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ ufCrm91CurrentPeriodStart: value }),
          ),
        ).toThrow(InvalidBitrixSubscriptionError)
      },
    )

    it('rejeita fim de período inválido', () => {
      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ ufCrm91CurrentPeriodEnd: null }),
        ),
      ).toThrow(InvalidBitrixSubscriptionError)
    })

    it('preserva a hora do offset do portal, convertida para UTC', () => {
      const subscription = mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({ ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00+03:00' }),
      )

      expect(subscription.currentPeriodStart.toISOString()).toBe(
        '2026-06-30T21:00:00.000Z',
      )
    })
  })

  describe('gatewayId', () => {
    it.each([null, undefined, ''])(
      'trata ausência (%s) como undefined, não como erro',
      raw => {
        expect(
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ ufCrm91GatewayId: raw }),
          ).gatewayId,
        ).toBeUndefined()
      },
    )

    it('preserva o id quando a assinatura já está espelhada no gateway', () => {
      expect(
        mapBitrixSpaSubscriptionToRawSubscription(validItem).gatewayId,
      ).toBe('sub_abc')
    })
  })

  it('lista os campos com problema na mensagem do erro', () => {
    let thrown: InvalidBitrixSubscriptionError | undefined

    try {
      mapBitrixSpaSubscriptionToRawSubscription({ id: 21 })
    } catch (error) {
      thrown = error as InvalidBitrixSubscriptionError
    }

    expect(thrown).toBeInstanceOf(InvalidBitrixSubscriptionError)

    const paths = thrown?.issues.map(issue => issue.path.join('.')) ?? []
    expect(paths).toContain('title')
    expect(paths).toContain('ufCrm91Plan')
    expect(paths).toContain(APLICATION_PARENT_FIELD)
    expect(thrown?.message).toContain('title')
  })
})

describe('collectBitrixSpaSubscriptionToRawSubscription', () => {
  it('mapeia a coleção inteira', () => {
    const subscriptions = collectBitrixSpaSubscriptionToRawSubscription([
      validItem,
      itemWith({ id: 22, ufCrm91Status: '13623' }),
    ])

    expect(subscriptions.map(s => s.id)).toEqual(['21', '22'])
    expect(subscriptions.map(s => s.status)).toEqual(['active', 'cancelled'])
  })

  it('devolve lista vazia para entrada vazia', () => {
    expect(collectBitrixSpaSubscriptionToRawSubscription([])).toEqual([])
  })
})

describe('mapSubscriptionInputToBitrixFields', () => {
  const input: CreateSubscriptionInput = {
    name: 'ThinkZap Pro — Acme',
    planId: '7',
    aplicationSpaId: '512',
    status: 'trialing',
    currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    gatewayId: 'sub_abc',
  }

  it('traduz o input completo para os campos da SPA', () => {
    expect(mapSubscriptionInputToBitrixFields(input)).toEqual({
      title: 'ThinkZap Pro — Acme',
      ufCrm91Plan: '7',
      [APLICATION_PARENT_FIELD]: '512',
      ufCrm91Status: '13619',
      ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00.000Z',
      ufCrm91CurrentPeriodEnd: '2026-08-01T00:00:00.000Z',
      ufCrm91GatewayId: 'sub_abc',
    })
  })

  it('omite os campos ausentes no patch em vez de enviá-los como null', () => {
    expect(mapSubscriptionInputToBitrixFields({ status: 'cancelled' })).toEqual(
      {
        ufCrm91Status: '13623',
      },
    )
  })

  it('não emite nada para um patch vazio', () => {
    expect(mapSubscriptionInputToBitrixFields({})).toEqual({})
  })

  it.each<Subscription['status']>([
    'active',
    'trialing',
    'past_due',
    'cancelled',
  ])('faz round-trip do status %s pelo ID de enum', status => {
    const fields = mapSubscriptionInputToBitrixFields({ status })

    const backToDomain = mapBitrixSpaSubscriptionToRawSubscription(
      itemWith({ ufCrm91Status: fields.ufCrm91Status }),
    )

    expect(backToDomain.status).toBe(status)
  })
})
