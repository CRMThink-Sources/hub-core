import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureImbotButtonApp } from './ensure-imbot-button-app'
import { fetchPlacementHandlers } from './normalize-placement-get-response'

vi.mock('./build-button-im-textarea-placement-params', () => ({
  buildButtonImTextareaPlacementBindParams: () => ({
    PLACEMENT: 'IM_TEXTAREA' as const,
    HANDLER: 'https://app.example/bitrix/widget/button',
    TITLE: 'ThinkZap Botões',
    LANG_ALL: { pt: { TITLE: 'ThinkZap Botões' } },
    OPTIONS: {
      iconName: 'list-check',
      context: 'LINES',
      role: 'USER',
      extranet: 'N',
      color: 'GREEN',
      width: '400',
      height: '480',
    },
  }),
}))

vi.mock('./normalize-placement-get-response', () => ({
  fetchPlacementHandlers: vi.fn(),
}))

describe('EnsureImbotButtonApp', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureImbotButtonApp()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('binds IM_TEXTAREA placement when not registered yet', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValueOnce([])
    callMethod.mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(fetchPlacementHandlers).toHaveBeenCalled()
    expect(callMethod).toHaveBeenCalledWith(
      'placement.bind',
      expect.objectContaining({
        PLACEMENT: 'IM_TEXTAREA',
      }),
    )
    expect(callMethod.mock.calls[0]?.[1]).toMatchObject({
      OPTIONS: { context: 'LINES' },
    })
  })

  it('returns updated when handler already exists', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValueOnce([
      {
        placement: 'IM_TEXTAREA',
        handler: 'https://app.example/bitrix/widget/button',
        title: 'ThinkZap Botões',
      },
    ])
    callMethod.mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
  })

  it('returns skipped when bind returns false', async () => {
    vi.mocked(fetchPlacementHandlers).mockResolvedValueOnce([])
    callMethod.mockResolvedValueOnce(false)

    const result = await service.execute(client)

    expect(result).toBe('skipped')
  })
})
