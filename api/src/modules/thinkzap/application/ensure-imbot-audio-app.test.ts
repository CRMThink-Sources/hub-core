import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureImbotAudioApp } from './ensure-imbot-audio-app'

vi.mock('./build-audio-im-textarea-placement-params', () => ({
  buildAudioImTextareaPlacementBindParams: () => ({
    PLACEMENT: 'IM_TEXTAREA' as const,
    HANDLER: 'https://app.example/bitrix/widget/audio',
    TITLE: 'ThinkZap Audio',
    LANG_ALL: { pt: { TITLE: 'ThinkZap Audio' } },
    OPTIONS: {
      iconName: 'chat-compose',
      context: 'LINES',
      role: 'USER',
      extranet: 'N',
      color: 'GREEN',
      width: '400',
      height: '320',
    },
  }),
}))

describe('EnsureImbotAudioApp', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureImbotAudioApp()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('binds IM_TEXTAREA placement when not registered yet', async () => {
    callMethod.mockResolvedValueOnce([]).mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenNthCalledWith(
      1,
      'placement.get',
      expect.anything(),
    )
    expect(callMethod).toHaveBeenNthCalledWith(
      2,
      'placement.bind',
      expect.objectContaining({
        PLACEMENT: 'IM_TEXTAREA',
      }),
    )
    expect(callMethod.mock.calls[1]?.[1]).toMatchObject({
      OPTIONS: { context: 'LINES' },
    })
  })

  it('returns updated when handler already exists', async () => {
    callMethod
      .mockResolvedValueOnce([
        {
          placement: 'IM_TEXTAREA',
          handler: 'https://app.example/bitrix/widget/audio',
        },
      ])
      .mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
  })

  it('returns skipped when bind returns false', async () => {
    callMethod.mockResolvedValueOnce([]).mockResolvedValueOnce(false)

    const result = await service.execute(client)

    expect(result).toBe('skipped')
  })
})
