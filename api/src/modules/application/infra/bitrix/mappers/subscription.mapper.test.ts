import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiLogger } from '@/shared/infra/logger'
import { SUBSCRIPTION_MODALITY_FIELD } from '../ensure-subscription-modality-field'
import {
  APLICATION_PARENT_FIELD,
  collectBitrixSpaSubscriptionToRawSubscription,
  mapBitrixSpaSubscriptionToRawSubscription,
  mapSubscriptionInputToBitrixFields,
} from './subscription.mapper'
import { InvalidBitrixSubscriptionError } from '../errors/invalid-bitrix-subscription.error'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { CreateSubscriptionInput } from '@/modules/application/domain/repositories/subscription.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const validItem = {
  id: 21,
  title: 'ThinkZap Pro — Acme',
  ufCrm91Plan: '7',
  [APLICATION_PARENT_FIELD]: 512,
  ufCrm91Status: '13617',
  ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00+03:00',
  ufCrm91CurrentPeriodEnd: '2026-08-01T00:00:00+03:00',
  ufCrm91GatewayId: 'sub_abc',
  [SUBSCRIPTION_MODALITY_FIELD]: 'stripe',
}

const itemWith = (overrides: Record<string, unknown>) => ({
  ...validItem,
  ...overrides,
})

beforeEach(() => {
  vi.mocked(apiLogger.warn).mockClear()
})

describe('mapBitrixSpaSubscriptionToRawSubscription', () => {
  it('mapeia um item válido da SPA', () => {
    expect(mapBitrixSpaSubscriptionToRawSubscription(validItem)).toEqual({
      id: '21',
      name: 'ThinkZap Pro — Acme',
      planId: '7',
      aplicationSpaId: '512',
      status: 'active',
      // Dias de calendário: início no começo do dia, fim no último instante dele.
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T23:59:59.999Z'),
      gatewayId: 'sub_abc',
      modality: 'stripe',
    })
  })

  describe('status', () => {
    it.each([
      ['13617', 'active'],
      ['13619', 'trialing'],
      ['13621', 'past_due'],
      ['13623', 'cancelled'],
      ['14353', 'trial_expired'],
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

    /**
     * O incidente que motivou isto: o CRM ganhou um id de enum novo, e a mensagem
     * dizia só `campos: ufCrm91Status`. Descobrir qual id era exigiu abrir a SPA.
     */
    it('nomeia o campo e o valor recusado na mensagem do erro', () => {
      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ ufCrm91Status: '99999' }),
        ),
      ).toThrow(/ufCrm91Status.*99999/)
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

    /**
     * Este teste afirmava o bug de D-1: converter o instante preservava a hora do
     * portal e jogava o **dia** para trás em qualquer fuso a oeste dele. O campo é
     * um dia, e é o dia que tem que sobreviver — ver `spa-calendar-date.ts`.
     */
    it('lê o dia denotado pelo offset do portal, ancorado no início do dia', () => {
      const subscription = mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({ ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00+03:00' }),
      )

      expect(subscription.currentPeriodStart.toISOString()).toBe(
        '2026-07-01T00:00:00.000Z',
      )
    })

    it('ancora o fim de período no último instante do dia', () => {
      const subscription = mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({ ufCrm91CurrentPeriodEnd: '2026-08-01T00:00:00+03:00' }),
      )

      expect(subscription.currentPeriodEnd.toISOString()).toBe(
        '2026-08-01T23:59:59.999Z',
      )
    })

    /** A hora que vier no valor não move o dia. */
    it('ignora a hora dentro do dia', () => {
      const subscription = mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({ ufCrm91CurrentPeriodEnd: '2026-08-01T23:30:00+03:00' }),
      )

      expect(subscription.currentPeriodEnd.toISOString()).toBe(
        '2026-08-01T23:59:59.999Z',
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

  describe('modalidade', () => {
    it.each<['stripe' | 'manual']>([['stripe'], ['manual']])(
      'lê o valor gravado (%s)',
      modality => {
        expect(
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ [SUBSCRIPTION_MODALITY_FIELD]: modality }),
          ).modality,
        ).toBe(modality)
      },
    )

    it.each([null, undefined, ''])(
      'resolve manual quando o campo vem vazio (%s), sem warning',
      raw => {
        expect(
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ [SUBSCRIPTION_MODALITY_FIELD]: raw }),
          ).modality,
        ).toBe('manual')
        expect(apiLogger.warn).not.toHaveBeenCalled()
      },
    )

    /**
     * O caso das assinaturas criadas antes do campo existir: a chave nem chega no
     * item. Silencioso de propósito — não há nada a corrigir no CRM.
     */
    it('resolve manual quando a chave não existe no item, sem warning', () => {
      const { [SUBSCRIPTION_MODALITY_FIELD]: _omitted, ...beforeTheField } =
        validItem

      expect(
        mapBitrixSpaSubscriptionToRawSubscription(beforeTheField).modality,
      ).toBe('manual')
      expect(apiLogger.warn).not.toHaveBeenCalled()
    })

    /**
     * Aí sim alguém digitou algo que o produto não entende — inclusive o id de
     * enum que um campo de lista devolveria. `warn`, porque a consequência
     * (cliente do gateway sem portal) não aparece em nenhum outro lugar.
     */
    it.each([['boleto'], ['13617'], ['STRIPE']])(
      'resolve manual com warning para valor desconhecido (%s)',
      raw => {
        expect(
          mapBitrixSpaSubscriptionToRawSubscription(
            itemWith({ [SUBSCRIPTION_MODALITY_FIELD]: raw }),
          ).modality,
        ).toBe('manual')
        expect(apiLogger.warn).toHaveBeenCalledTimes(1)
      },
    )

    it('não reprova o item por causa da modalidade', () => {
      expect(() =>
        mapBitrixSpaSubscriptionToRawSubscription(
          itemWith({ [SUBSCRIPTION_MODALITY_FIELD]: 'lixo' }),
        ),
      ).not.toThrow()
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
    modality: 'stripe',
  }

  it('traduz o input completo para os campos da SPA', () => {
    expect(mapSubscriptionInputToBitrixFields(input)).toEqual({
      title: 'ThinkZap Pro — Acme',
      ufCrm91Plan: '7',
      [APLICATION_PARENT_FIELD]: '512',
      ufCrm91Status: '13619',
      // Meio-dia UTC: o dia sobrevive à leitura em qualquer offset de portal.
      ufCrm91CurrentPeriodStart: '2026-07-01T12:00:00.000Z',
      ufCrm91CurrentPeriodEnd: '2026-08-01T12:00:00.000Z',
      ufCrm91GatewayId: 'sub_abc',
      [SUBSCRIPTION_MODALITY_FIELD]: 'stripe',
    })
  })

  /**
   * Escrita explícita, ao contrário da leitura tolerante: um patch de status não
   * pode reescrever a modalidade de uma assinatura Stripe como `manual`.
   */
  it('omite a modalidade quando não informada', () => {
    expect(
      mapSubscriptionInputToBitrixFields({ status: 'cancelled' }),
    ).not.toHaveProperty(SUBSCRIPTION_MODALITY_FIELD)
  })

  it('faz round-trip da modalidade', () => {
    const fields = mapSubscriptionInputToBitrixFields({ modality: 'stripe' })

    expect(
      mapBitrixSpaSubscriptionToRawSubscription(
        itemWith({
          [SUBSCRIPTION_MODALITY_FIELD]: fields[SUBSCRIPTION_MODALITY_FIELD],
        }),
      ).modality,
    ).toBe('stripe')
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

  /**
   * A propriedade que fecha o bug de D-1: o dia escrito é o dia lido de volta.
   * Antes, a escrita mandava a hora real e a leitura convertia o instante — as duas
   * pontas derivavam, em direções opostas.
   */
  it('faz round-trip do dia de período', () => {
    const fields = mapSubscriptionInputToBitrixFields({
      currentPeriodEnd: new Date('2026-08-01T23:59:59.999Z'),
    })

    const backToDomain = mapBitrixSpaSubscriptionToRawSubscription(
      itemWith({
        ufCrm91CurrentPeriodEnd: fields.ufCrm91CurrentPeriodEnd,
      }),
    )

    expect(backToDomain.currentPeriodEnd.toISOString()).toBe(
      '2026-08-01T23:59:59.999Z',
    )
  })

  /**
   * O caso da escrita que gravava o dia errado: 22:00 em Brasília já é o dia
   * seguinte em UTC, e `.toISOString()` cru levava esse dia.
   */
  it('escrita perto da virada do dia grava o dia do domínio', () => {
    const fields = mapSubscriptionInputToBitrixFields({
      currentPeriodEnd: new Date('2026-08-01T23:59:59.999Z'),
    })

    expect(fields.ufCrm91CurrentPeriodEnd).toBe('2026-08-01T12:00:00.000Z')
  })

  /**
   * `trial_expired` entra aqui apesar de nenhum caminho do produto o escrever: o
   * mapa de escrita é a inversão do de leitura, e o round-trip é o que garante
   * que os dois não podem discordar.
   */
  it('emite o ID de enum do teste expirado', () => {
    expect(
      mapSubscriptionInputToBitrixFields({ status: 'trial_expired' }),
    ).toEqual({ ufCrm91Status: '14353' })
  })

  it.each<Subscription['status']>([
    'active',
    'trialing',
    'past_due',
    'cancelled',
    'trial_expired',
  ])('faz round-trip do status %s pelo ID de enum', status => {
    const fields = mapSubscriptionInputToBitrixFields({ status })

    const backToDomain = mapBitrixSpaSubscriptionToRawSubscription(
      itemWith({ ufCrm91Status: fields.ufCrm91Status }),
    )

    expect(backToDomain.status).toBe(status)
  })
})
