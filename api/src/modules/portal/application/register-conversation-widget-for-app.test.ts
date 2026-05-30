import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerConversationWidgetForApp } from './register-conversation-widget-for-app'
import { ensureConversationWidgetPlacements } from '@/modules/thinkzap/application/ensure-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/ensure-conversation-widget-placements')
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))

describe('registerConversationWidgetForApp', () => {
  const client = { callMethod: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBitrixClientForApp).mockResolvedValue({
      client: client as never,
      domainName: 'empresa.bitrix24.com.br',
    })
    vi.mocked(ensureConversationWidgetPlacements).mockResolvedValue('created')
  })

  it('resolves client and registers conversation widget placements', async () => {
    const result = await registerConversationWidgetForApp('app-1')

    expect(resolveBitrixClientForApp).toHaveBeenCalledWith('app-1')
    expect(ensureConversationWidgetPlacements).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'created' })
  })
})
