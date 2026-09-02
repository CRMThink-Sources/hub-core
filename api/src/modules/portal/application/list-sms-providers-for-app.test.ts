import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMethod = vi.fn()

vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(() =>
    Promise.resolve({
      client: { callMethod },
      domainName: 'cliente.bitrix24.com.br',
    }),
  ),
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  ForeignSmsSenderCodeError,
  deleteSmsProviderByCodeForApp,
  listSmsProvidersForApp,
} from './list-sms-providers-for-app'

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

const item = (
  id: string,
  name: string,
  metadata: SubscriptionItem['metadata'] = {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  },
): SubscriptionItem => ({
  id,
  name,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const deps = (items: SubscriptionItem[]) =>
  ({
    getApp: { getById: vi.fn().mockResolvedValue(APP) },
    getAplicationContext: {
      execute: vi.fn().mockResolvedValue({
        subscriptions: [{ status: 'active', items }],
      }),
    },
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  callMethod.mockResolvedValue([])
})

describe('listSmsProvidersForApp', () => {
  it('lista as linhas mesmo sem nenhum provedor registrado', async () => {
    const output = await listSmsProvidersForApp(
      'app-1',
      deps([item('4821', 'Comercial')]),
    )

    expect(output.senders).toEqual([])
    expect(output.lines).toEqual([
      {
        subscriptionItemId: '4821',
        name: 'Comercial',
        provider: 'ZAPI',
        registered: false,
      },
    ])
  })

  it('marca como registrada a linha que já tem sender', async () => {
    callMethod.mockResolvedValue([
      { CODE: 'thinkzap_sms_4821', NAME: 'ThinkZap WhatsApp — Comercial' },
    ])

    const output = await listSmsProvidersForApp(
      'app-1',
      deps([item('4821', 'Comercial'), item('4822', 'Suporte')]),
    )

    expect(
      output.lines.map(line => [line.subscriptionItemId, line.registered]),
    ).toEqual([
      ['4821', true],
      ['4822', false],
    ])
  })

  it('não confunde sender órfão com linha registrada', async () => {
    callMethod.mockResolvedValue([
      { CODE: 'thinkzap_sms_9999', NAME: 'ThinkZap WhatsApp — Antiga' },
    ])

    const output = await listSmsProvidersForApp(
      'app-1',
      deps([item('4821', 'Comercial')]),
    )

    expect(output.lines[0]?.registered).toBe(false)
    expect(output.senders).toEqual([
      expect.objectContaining({ code: 'thinkzap_sms_9999', orphan: true }),
    ])
  })

  it('não lista item que não é linha', async () => {
    const output = await listSmsProvidersForApp(
      'app-1',
      deps([
        item('4821', 'Comercial'),
        item('4823', 'Só cobrança', { provider: 'NONE' }),
      ]),
    )

    expect(output.lines.map(line => line.subscriptionItemId)).toEqual(['4821'])
  })

  it('leva o provider da linha, para a tela decidir o aviso de ban', async () => {
    const output = await listSmsProvidersForApp(
      'app-1',
      deps([
        item('4824', 'Oficial', {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'C-9',
        }),
      ]),
    )

    expect(output.lines[0]?.provider).toBe('HUBMESSAGE')
  })
})

describe('deleteSmsProviderByCodeForApp', () => {
  it('remove o órfão pelo CODE cru', async () => {
    const output = await deleteSmsProviderByCodeForApp(
      'app-1',
      'thinkzap_sms_9999',
    )

    expect(output).toEqual({ result: 'deleted' })
    expect(callMethod).toHaveBeenCalledWith('messageservice.sender.delete', {
      CODE: 'thinkzap_sms_9999',
    })
  })

  it('recusa CODE de outro app sem chamar o Bitrix', async () => {
    await expect(
      deleteSmsProviderByCodeForApp('app-1', 'outro_app_1'),
    ).rejects.toBeInstanceOf(ForeignSmsSenderCodeError)
    expect(callMethod).not.toHaveBeenCalled()
  })
})
