import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const callMethod = vi.fn()

/**
 * `env` **não** é mockado — a cadeia de import de `makeGetAplicationContext` passa por
 * `redis-connection`, e substituir o módulo aqui a quebraria. A variável é posta antes
 * do import de `@/config/env`, que lê `process.env` na avaliação do módulo.
 */
vi.hoisted(() => {
  process.env.BITRIX_SMS_HANDLER_URL =
    'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider'
})

vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(() =>
    Promise.resolve({
      client: { callMethod },
      domainName: 'cliente.bitrix24.com.br',
    }),
  ),
}))

import { InvalidSmsSenderCodeError } from '@/modules/thinkzap/application/helpers/sms-sender-code'
import { deleteSmsProviderForApp } from './delete-sms-provider-for-app'
import { registerSmsProviderForApp } from './register-sms-provider-for-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

const item = (overrides: Partial<SubscriptionItem> = {}): SubscriptionItem => ({
  id: '4821',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  },
  ...overrides,
})

const deps = (lineItem: SubscriptionItem) =>
  ({
    getApp: { getById: vi.fn().mockResolvedValue(APP) },
    getAplicationContext: {
      execute: vi.fn().mockResolvedValue({
        subscriptions: [{ status: 'active', items: [lineItem] }],
      }),
    },
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  callMethod.mockResolvedValue({})
})

describe('registerSmsProviderForApp', () => {
  it('registra o provedor da linha com o CODE derivado do item', async () => {
    const output = await registerSmsProviderForApp(
      'app-1',
      '4821',
      deps(item()),
    )

    expect(output).toEqual({ result: 'created' })
    expect(callMethod).toHaveBeenCalledWith(
      'messageservice.sender.add',
      expect.objectContaining({ CODE: 'thinkzap_sms_4821', TYPE: 'SMS' }),
    )
  })

  it('registra a linha oficial pelo mesmo caminho', async () => {
    await registerSmsProviderForApp(
      'app-1',
      '4821',
      deps(
        item({
          metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' },
        }),
      ),
    )

    expect(callMethod).toHaveBeenCalledWith(
      'messageservice.sender.add',
      expect.objectContaining({ CODE: 'thinkzap_sms_4821' }),
    )
  })

  it('recusa item inexistente sem resolver credencial do Bitrix', async () => {
    await expect(
      registerSmsProviderForApp('app-1', 'outro-item', deps(item())),
    ).rejects.toBeInstanceOf(LineNotFoundError)
    expect(resolveBitrixClientForApp).not.toHaveBeenCalled()
    expect(callMethod).not.toHaveBeenCalled()
  })

  it('recusa item que não é linha sem chamar o Bitrix', async () => {
    await expect(
      registerSmsProviderForApp(
        'app-1',
        '4821',
        deps(item({ metadata: { provider: 'NONE' } })),
      ),
    ).rejects.toBeInstanceOf(LineProviderNotSupportedError)
    expect(callMethod).not.toHaveBeenCalled()
  })

  it('recusa id fora do charset do CODE sem chamar o Bitrix', async () => {
    await expect(
      registerSmsProviderForApp('app-1', '48/21', deps(item({ id: '48/21' }))),
    ).rejects.toBeInstanceOf(InvalidSmsSenderCodeError)
    expect(callMethod).not.toHaveBeenCalled()
  })
})

describe('deleteSmsProviderForApp', () => {
  it('remove o provedor da linha', async () => {
    const output = await deleteSmsProviderForApp('app-1', '4821', deps(item()))

    expect(output).toEqual({ result: 'deleted' })
    expect(callMethod).toHaveBeenCalledWith('messageservice.sender.delete', {
      CODE: 'thinkzap_sms_4821',
    })
  })

  it('recusa item que não é linha', async () => {
    await expect(
      deleteSmsProviderForApp(
        'app-1',
        '4821',
        deps(item({ metadata: { provider: 'NONE' } })),
      ),
    ).rejects.toBeInstanceOf(LineProviderNotSupportedError)
  })
})
