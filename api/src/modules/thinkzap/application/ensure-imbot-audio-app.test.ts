import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureImbotAudioApp } from './ensure-imbot-audio-app'

describe('EnsureImbotAudioApp', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureImbotAudioApp()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers then updates icon via imbot.app.update', async () => {
    callMethod.mockResolvedValueOnce(55).mockResolvedValueOnce(true)

    const result = await service.execute(client, 12)

    expect(result).toBe('updated')
    expect(callMethod).toHaveBeenNthCalledWith(
      1,
      'imbot.app.register',
      expect.objectContaining({ BOT_ID: 12, CONTEXT: 'LINES' }),
    )
    const updateCall = callMethod.mock.calls[1] as [
      string,
      { APP_ID: number; ICON_FILE: string },
    ]
    expect(updateCall[0]).toBe('imbot.app.update')
    expect(updateCall[1].APP_ID).toBe(55)
    expect(updateCall[1].ICON_FILE.length).toBeGreaterThan(100)
  })

  it('returns skipped when register does not return app id', async () => {
    callMethod.mockResolvedValue(0)

    const result = await service.execute(client, 12)

    expect(result).toBe('skipped')
    expect(callMethod).toHaveBeenCalledTimes(1)
  })
})
