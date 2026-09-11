import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareOpenLineOutboundText } from './prepare-open-line-outbound-text'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { apiLogger } from '@/shared/infra/logger'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const PREFIX_ON = {
  prefixOperatorNameEnabled: true,
  messageUpdateEventEnabled: false,
  messageDeleteEventEnabled: false,
  widgetOpenChannelEnabled: false,
}

describe('prepareOpenLineOutboundText', () => {
  beforeEach(() => {
    vi.mocked(apiLogger.warn).mockClear()
  })

  it('returns raw text when prefix setting is disabled', async () => {
    const getDisplayName = vi.fn()

    const result = await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: DEFAULT_CONNECTOR_SETTINGS,
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: { getDisplayName },
    })

    expect(result).toBe('Olá')
    expect(getDisplayName).not.toHaveBeenCalled()
    expect(apiLogger.warn).not.toHaveBeenCalled()
  })

  it('returns prefixed text when setting is enabled', async () => {
    const result = await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: PREFIX_ON,
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: {
        getDisplayName: vi.fn().mockResolvedValue({ name: 'João Silva' }),
      },
    })

    expect(result).toBe('*João Silva:* Olá')
    expect(apiLogger.warn).not.toHaveBeenCalled()
  })

  it('warns and delivers raw text when the operator name is unresolved', async () => {
    const onPrefixUnresolved = vi.fn()

    const result = await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: PREFIX_ON,
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: {
        getDisplayName: vi.fn().mockResolvedValue({
          name: null,
          refusal: 'Bitrix error: 400 - insufficient_scope',
        }),
      },
      onPrefixUnresolved,
    })

    expect(result).toBe('Olá')

    expect(onPrefixUnresolved).toHaveBeenCalledWith({
      operatorUserId: '42',
      failure: 'bitrix-refused',
      refusal: 'Bitrix error: 400 - insufficient_scope',
    })

    const [payload, message] = vi.mocked(apiLogger.warn).mock.calls[0] ?? []
    expect(payload).toMatchObject({
      errorCode: 'thinkzap.message.operator_prefix_unresolved',
      operatorUserId: '42',
      prefixFailure: 'bitrix-refused',
      refusal: 'Bitrix error: 400 - insufficient_scope',
    })
    expect(message).toContain('insufficient_scope')
  })

  it('names the empty record when Bitrix did not refuse', async () => {
    const onPrefixUnresolved = vi.fn()

    await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: PREFIX_ON,
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: {
        getDisplayName: vi.fn().mockResolvedValue({ name: null }),
      },
      onPrefixUnresolved,
    })

    expect(onPrefixUnresolved).toHaveBeenCalledWith({
      operatorUserId: '42',
      failure: 'bitrix-empty',
      refusal: undefined,
    })
  })
})
