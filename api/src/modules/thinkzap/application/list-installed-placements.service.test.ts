import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ListInstalledPlacementsService } from './list-installed-placements.service'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      placement: { url: 'https://app.example/placement' },
      iframeAudio: { url: 'https://app.example/bitrix/widget/audio' },
      iframeButton: { url: 'https://app.example/bitrix/widget/button' },
    },
  },
}))

describe('ListInstalledPlacementsService', () => {
  const getPlacementHandlers = vi.fn()
  const client = { getPlacementHandlers } as unknown as BitrixRestClient
  const service = new ListInstalledPlacementsService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates error when placement.get fails', async () => {
    getPlacementHandlers.mockRejectedValue(new Error('fail'))

    await expect(service.execute(client)).rejects.toThrow('fail')
  })

  it('normalizes camelCase and UPPER_CASE entries', async () => {
    getPlacementHandlers.mockResolvedValue([
      {
        PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
        HANDLER: 'https://app.example/placement',
        TITLE: 'ThinkZap',
      },
      {
        placement: 'IM_TEXTAREA',
        handler: 'https://other.example/handler',
        title: 'Other App',
      },
    ])

    const result = await service.execute(client)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      placement: 'CRM_DEAL_DETAIL_TAB',
      handler: 'https://app.example/placement',
      title: 'ThinkZap',
      isThinkzap: true,
    })
    expect(result[1]).toMatchObject({
      placement: 'IM_TEXTAREA',
      handler: 'https://other.example/handler',
      title: 'Other App',
      isThinkzap: false,
    })
  })

  it('handles wrapped result array', async () => {
    getPlacementHandlers.mockResolvedValue({
      result: [
        {
          placement: 'CRM_LEAD_DETAIL_TAB',
          handler: 'https://app.example/bitrix/widget/audio',
        },
      ],
    })

    const result = await service.execute(client)

    expect(result).toEqual([
      {
        placement: 'CRM_LEAD_DETAIL_TAB',
        handler: 'https://app.example/bitrix/widget/audio',
        title: null,
        isThinkzap: true,
      },
    ])
  })

  it('flags the button widget placement as thinkzap', async () => {
    getPlacementHandlers.mockResolvedValue([
      {
        placement: 'IM_TEXTAREA',
        handler: 'https://app.example/bitrix/widget/button',
      },
    ])

    const result = await service.execute(client)

    expect(result).toEqual([
      {
        placement: 'IM_TEXTAREA',
        handler: 'https://app.example/bitrix/widget/button',
        title: null,
        isThinkzap: true,
      },
    ])
  })

  it('sorts by placement then handler', async () => {
    getPlacementHandlers.mockResolvedValue([
      { placement: 'CRM_LEAD_DETAIL_TAB', handler: 'https://b.example' },
      { placement: 'CRM_CONTACT_DETAIL_TAB', handler: 'https://a.example' },
      { placement: 'CRM_LEAD_DETAIL_TAB', handler: 'https://a.example' },
    ])

    const result = await service.execute(client)

    expect(result.map(item => `${item.placement}:${item.handler}`)).toEqual([
      'CRM_CONTACT_DETAIL_TAB:https://a.example',
      'CRM_LEAD_DETAIL_TAB:https://a.example',
      'CRM_LEAD_DETAIL_TAB:https://b.example',
    ])
  })
})
