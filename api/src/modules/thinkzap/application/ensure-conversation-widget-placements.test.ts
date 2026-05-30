import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureConversationWidgetPlacements } from './ensure-conversation-widget-placements'
import { fetchPlacementHandlers } from './normalize-placement-get-response'

vi.mock('./build-crm-detail-placement-bind-params', () => ({
  CRM_DETAIL_PLACEMENTS: [
    'CRM_CONTACT_DETAIL_TAB',
    'CRM_COMPANY_DETAIL_TAB',
    'CRM_DEAL_DETAIL_TAB',
    'CRM_LEAD_DETAIL_TAB',
  ],
  buildCrmDetailPlacementBindParams: () => [
    {
      PLACEMENT: 'CRM_CONTACT_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
      TITLE: 'ThinkZap',
      LANG_ALL: { pt: { TITLE: 'ThinkZap' } },
    },
    {
      PLACEMENT: 'CRM_COMPANY_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
      TITLE: 'ThinkZap',
      LANG_ALL: { pt: { TITLE: 'ThinkZap' } },
    },
    {
      PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
      TITLE: 'ThinkZap',
      LANG_ALL: { pt: { TITLE: 'ThinkZap' } },
    },
    {
      PLACEMENT: 'CRM_LEAD_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
      TITLE: 'ThinkZap',
      LANG_ALL: { pt: { TITLE: 'ThinkZap' } },
    },
  ],
}))

vi.mock('./normalize-placement-get-response', () => ({
  fetchPlacementHandlers: vi.fn(),
}))

describe('EnsureConversationWidgetPlacements', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureConversationWidgetPlacements()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('binds all CRM placements when not registered yet', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValueOnce([])
    callMethod.mockResolvedValue(true)

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(fetchPlacementHandlers).toHaveBeenCalled()
    expect(callMethod).toHaveBeenCalledWith(
      'placement.bind',
      expect.objectContaining({
        PLACEMENT: 'CRM_CONTACT_DETAIL_TAB',
      }),
    )
    expect(
      callMethod.mock.calls.filter(call => call[0] === 'placement.bind'),
    ).toHaveLength(4)
  })

  it('returns updated when at least one handler already exists', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValue([
      {
        placement: 'CRM_CONTACT_DETAIL_TAB',
        handler: 'https://app.example/widgets/conversations',
        title: 'ThinkZap',
      },
    ])
    callMethod.mockResolvedValue(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
  })

  it('returns skipped when all binds fail', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValueOnce([])
    callMethod.mockResolvedValue(false)

    const result = await service.execute(client)

    expect(result).toBe('skipped')
  })
})
