import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteConversationWidgetForApp } from './delete-conversation-widget-for-app'
import { deleteConversationWidgetPlacements } from '@/modules/thinkzap/application/delete-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/delete-conversation-widget-placements')
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))

describe('deleteConversationWidgetForApp', () => {
  const client = { callMethod: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBitrixClientForApp).mockResolvedValue({
      client: client as never,
      domainName: 'empresa.bitrix24.com.br',
    })
    vi.mocked(deleteConversationWidgetPlacements).mockResolvedValue('deleted')
  })

  it('resolves client and deletes conversation widget placements', async () => {
    const result = await deleteConversationWidgetForApp('app-1')

    expect(resolveBitrixClientForApp).toHaveBeenCalledWith('app-1')
    expect(deleteConversationWidgetPlacements).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'deleted' })
  })
})
