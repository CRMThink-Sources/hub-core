import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { MigrateAudioWidgetToImTextarea } from './migrate-audio-widget-to-im-textarea'

describe('MigrateAudioWidgetToImTextarea', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  const getOrCreateBot = { execute: vi.fn() }
  const unregisterIframe = { execute: vi.fn() }

  const service = new MigrateAudioWidgetToImTextarea(
    getOrCreateBot as never,
    unregisterIframe as never,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateBot.execute.mockResolvedValue(15)
    unregisterIframe.execute.mockResolvedValue(true)
    callMethod.mockResolvedValue(true)
  })

  it('creates bot, unregisters legacy iframe and binds IM_TEXTAREA', async () => {
    await service.execute(client)

    expect(getOrCreateBot.execute).toHaveBeenCalledWith(client)
    expect(unregisterIframe.execute).toHaveBeenCalledWith(client, 15)
    expect(callMethod).toHaveBeenCalledWith('placement.bind', {
      PLACEMENT: 'IM_TEXTAREA',
      HANDLER: env.bitrix.iframeAudio.url,
      TITLE: env.bitrix.iframeAudio.name,
      LANG_ALL: {
        pt: { TITLE: env.bitrix.iframeAudio.name },
        en: { TITLE: env.bitrix.iframeAudio.name },
        es: { TITLE: env.bitrix.iframeAudio.name },
      },
      OPTIONS: {
        iconName: 'fa-microphone',
        context: 'LINES',
        role: 'USER',
        color: 'GREEN',
        extranet: 'N',
      },
    })
  })

  it('throws when bot is unavailable', async () => {
    getOrCreateBot.execute.mockResolvedValue(null)

    await expect(service.execute(client)).rejects.toThrow(
      'ThinkZap bot not available for migration',
    )
    expect(unregisterIframe.execute).not.toHaveBeenCalled()
  })

  it('ignores placement.bind errors when widget is already bound', async () => {
    callMethod.mockRejectedValueOnce(new Error('Handler already exists'))

    await expect(service.execute(client)).resolves.toBeUndefined()
  })

  it('propagates unexpected placement.bind errors', async () => {
    callMethod.mockRejectedValueOnce(new Error('ACCESS_DENIED'))

    await expect(service.execute(client)).rejects.toThrow('ACCESS_DENIED')
  })
})
