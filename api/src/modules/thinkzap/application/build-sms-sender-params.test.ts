import { describe, expect, it, vi } from 'vitest'

const { smsSender } = vi.hoisted(() => ({
  smsSender: {
    codePrefix: 'thinkzap_sms',
    handlerUrl: 'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider',
  },
}))

vi.mock('@/config/env', () => ({
  env: { bitrix: { smsSender } },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { buildSmsSenderParams } from './build-sms-sender-params'
import {
  InvalidSmsSenderCodeError,
  fromSmsSenderCode,
  toSmsSenderCode,
} from './helpers/sms-sender-code'

const line = (overrides: Partial<SubscriptionItem> = {}): SubscriptionItem => ({
  id: '4821',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  ...overrides,
})

describe('buildSmsSenderParams', () => {
  it('deriva o CODE do id do item de assinatura', () => {
    expect(buildSmsSenderParams({ item: line() }).CODE).toBe(
      'thinkzap_sms_4821',
    )
  })

  it('manda TYPE SMS — é o único valor que o Bitrix aceita', () => {
    expect(buildSmsSenderParams({ item: line() }).TYPE).toBe('SMS')
  })

  it('leva o nome da linha e a marca de WhatsApp no NAME', () => {
    const { NAME } = buildSmsSenderParams({ item: line({ name: 'Suporte' }) })

    expect(NAME).toContain('Suporte')
    expect(NAME).toContain('WhatsApp')
  })

  it('descreve o provider da linha e, quando conhecido, o número', () => {
    const semNumero = buildSmsSenderParams({ item: line() })
    const comNumero = buildSmsSenderParams({
      item: line(),
      phone: '5511999998888',
    })

    expect(semNumero.DESCRIPTION).toContain('WhatsApp Web')
    expect(semNumero.DESCRIPTION).not.toContain('5511999998888')
    expect(comNumero.DESCRIPTION).toContain('5511999998888')
  })

  it('nomeia o WhatsApp Oficial na linha HUBMESSAGE', () => {
    const params = buildSmsSenderParams({
      item: line({
        metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan-1' },
      }),
    })

    expect(params.DESCRIPTION).toContain('WhatsApp Oficial')
  })

  it('leva o HANDLER configurado, sempre o corpo completo', () => {
    expect(buildSmsSenderParams({ item: line() })).toEqual({
      CODE: 'thinkzap_sms_4821',
      TYPE: 'SMS',
      HANDLER: 'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider',
      NAME: 'ThinkZap WhatsApp — Comercial',
      DESCRIPTION: 'Envia pela linha Comercial (WhatsApp Web)',
    })
  })

  it('recusa id fora do charset aceito pelo Bitrix', () => {
    expect(() => buildSmsSenderParams({ item: line({ id: '48/21' }) })).toThrow(
      InvalidSmsSenderCodeError,
    )
  })
})

describe('derivação do CODE', () => {
  it('vai e volta pelo mesmo prefixo', () => {
    expect(fromSmsSenderCode(toSmsSenderCode('4821'))).toBe('4821')
  })

  it('ignora sender de outro app', () => {
    expect(fromSmsSenderCode('outro_app_4821')).toBeNull()
  })

  it('ignora CODE com o prefixo e nada depois', () => {
    expect(fromSmsSenderCode('thinkzap_sms_')).toBeNull()
  })
})
