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

  it('registers imbot audio app and returns updated', async () => {
    callMethod.mockResolvedValue(55)

    const result = await service.execute(client, 12)

    expect(result).toBe('updated')
    expect(callMethod).toHaveBeenCalledWith(
      'imbot.app.register',
      expect.objectContaining({ BOT_ID: 12, CONTEXT: 'LINES' }),
    )
  })

  it('returns skipped when register does not return app id', async () => {
    callMethod.mockResolvedValue(0)

    const result = await service.execute(client, 12)

    expect(result).toBe('skipped')
  })
})
