import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { deleteImbotAudioApp } from './delete-imbot-audio-app'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      iframeAudio: {
        url: 'https://app.example/bitrix/widget/audio',
      },
    },
  },
}))

describe('deleteImbotAudioApp', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unbinds IM_TEXTAREA placement handler', async () => {
    callMethod.mockResolvedValue({ count: 1 })

    const result = await deleteImbotAudioApp(client)

    expect(result).toBe('deleted')
    expect(callMethod).toHaveBeenCalledWith('placement.unbind', {
      PLACEMENT: 'IM_TEXTAREA',
      HANDLER: 'https://app.example/bitrix/widget/audio',
    })
  })

  it('returns not_found when unbind removes nothing', async () => {
    callMethod.mockResolvedValue({ count: 0 })

    const result = await deleteImbotAudioApp(client)

    expect(result).toBe('not_found')
  })
})
