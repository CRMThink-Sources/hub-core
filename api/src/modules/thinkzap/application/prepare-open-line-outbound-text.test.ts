import { describe, expect, it, vi } from 'vitest'
import { prepareOpenLineOutboundText } from './prepare-open-line-outbound-text'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

describe('prepareOpenLineOutboundText', () => {
  it('returns raw text when prefix setting is disabled', async () => {
    const result = await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: DEFAULT_CONNECTOR_SETTINGS,
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: {
        getDisplayName: vi.fn(),
      },
    })

    expect(result).toBe('Olá')
  })

  it('returns prefixed text when setting is enabled', async () => {
    const result = await prepareOpenLineOutboundText({
      text: 'Olá',
      settings: { prefixOperatorNameEnabled: true },
      operatorUserId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName: {
        getDisplayName: vi.fn().mockResolvedValue('João Silva'),
      },
    })

    expect(result).toBe('João Silva: Olá')
  })
})
