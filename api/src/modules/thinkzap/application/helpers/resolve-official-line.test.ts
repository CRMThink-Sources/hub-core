import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it } from 'vitest'
import {
  assertEnabledOfficialLineInContext,
  findOfficialLineInContext,
} from './resolve-line-by-subscription-item'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { AplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const NOW = new Date('2026-08-12T12:00:00.000Z')
const AMANHA = new Date('2026-08-13T12:00:00.000Z')
const ONTEM = new Date('2026-08-11T12:00:00.000Z')

const base = {
  id: 'i1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active' as const,
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
}

const hubItem = (wabaId?: string): SubscriptionItem => ({
  ...base,
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9', wabaId },
})

const zapiItem = (): SubscriptionItem => ({
  ...base,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const noneItem = (): SubscriptionItem => ({
  ...base,
  metadata: { provider: 'NONE' },
})

const contextWith = (
  item: SubscriptionItem,
  subscription: { status: string; currentPeriodEnd: Date } = {
    status: 'active',
    currentPeriodEnd: AMANHA,
  },
): AplicationContext =>
  ({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', ...subscription, items: [item] }],
  }) as never

describe('findOfficialLineInContext', () => {
  it('resolve o canal e a WABA do metadata do item', () => {
    const line = findOfficialLineInContext(
      contextWith(hubItem('W-9')),
      'i1',
      NOW,
    )

    expect(line.channelId).toBe('C-9')
    expect(line.wabaId).toBe('W-9')
    expect(line.item.id).toBe('i1')
    expect(line.entitlement).toBe('active')
  })

  /** Canal existe desde o provisionamento; a WABA só nasce no embedded signup. */
  it('resolve com wabaId nulo enquanto o número não foi conectado', () => {
    const line = findOfficialLineInContext(contextWith(hubItem()), 'i1', NOW)

    expect(line.channelId).toBe('C-9')
    expect(line.wabaId).toBeNull()
  })

  describe('provider incompatível', () => {
    it('rejeita item ZAPI', () => {
      expect(() =>
        findOfficialLineInContext(contextWith(zapiItem()), 'i1', NOW),
      ).toThrow(LineProviderNotSupportedError)
    })

    it('rejeita item sem conector', () => {
      expect(() =>
        findOfficialLineInContext(contextWith(noneItem()), 'i1', NOW),
      ).toThrow(LineProviderNotSupportedError)
    })

    /**
     * Provider antes da habilitação: item que nunca foi linha oficial não pode ser
     * descrito como "seu teste acabou".
     */
    it('rejeita por provider mesmo com a assinatura vencida', () => {
      const context = contextWith(zapiItem(), {
        status: 'trialing',
        currentPeriodEnd: ONTEM,
      })

      expect(() => findOfficialLineInContext(context, 'i1', NOW)).toThrow(
        LineProviderNotSupportedError,
      )
    })
  })

  it('lança LineNotFoundError para item fora da árvore da instalação', () => {
    expect(() =>
      findOfficialLineInContext(contextWith(hubItem('W-9')), 'de-outro', NOW),
    ).toThrow(LineNotFoundError)
  })

  /** A leitura da aba de conexão precisa da linha bloqueada para explicá-la. */
  it('devolve a linha bloqueada, com a habilitação', () => {
    const context = contextWith(hubItem('W-9'), {
      status: 'trialing',
      currentPeriodEnd: ONTEM,
    })

    expect(findOfficialLineInContext(context, 'i1', NOW).entitlement).toBe(
      'trial-expired',
    )
  })
})

describe('assertEnabledOfficialLineInContext', () => {
  it('devolve a linha habilitada', () => {
    const line = assertEnabledOfficialLineInContext(
      contextWith(hubItem('W-9')),
      'i1',
      NOW,
    )

    expect(line.channelId).toBe('C-9')
  })

  it('recusa linha com o teste encerrado', () => {
    const context = contextWith(hubItem('W-9'), {
      status: 'trialing',
      currentPeriodEnd: ONTEM,
    })

    expect(() =>
      assertEnabledOfficialLineInContext(context, 'i1', NOW),
    ).toThrow(LineBlockedError)
  })

  it('recusa linha de assinatura cancelada', () => {
    const context = contextWith(hubItem('W-9'), {
      status: 'cancelled',
      currentPeriodEnd: AMANHA,
    })

    expect(() =>
      assertEnabledOfficialLineInContext(context, 'i1', NOW),
    ).toThrow(LineBlockedError)
  })

  it('recusa por provider antes de olhar a habilitação', () => {
    const context = contextWith(noneItem(), {
      status: 'trialing',
      currentPeriodEnd: ONTEM,
    })

    expect(() =>
      assertEnabledOfficialLineInContext(context, 'i1', NOW),
    ).toThrow(LineProviderNotSupportedError)
  })
})
