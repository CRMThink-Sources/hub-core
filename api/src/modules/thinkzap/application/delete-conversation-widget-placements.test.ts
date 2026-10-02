import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { deleteConversationWidgetPlacements } from './delete-conversation-widget-placements'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      placement: {
        url: 'https://app.example/widgets/conversations',
      },
    },
  },
}))

describe('deleteConversationWidgetPlacements', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unbinds all CRM detail placements', async () => {
    callMethod.mockResolvedValue({ count: 1 })

    const result = await deleteConversationWidgetPlacements(client)

    expect(result).toBe('deleted')
    expect(callMethod).toHaveBeenCalledTimes(4)
    expect(callMethod).toHaveBeenCalledWith('placement.unbind', {
      PLACEMENT: 'CRM_CONTACT_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
    })
  })

  it('returns not_found when nothing is removed', async () => {
    callMethod.mockResolvedValue({ count: 0 })

    const result = await deleteConversationWidgetPlacements(client)

    expect(result).toBe('not_found')
  })
})
