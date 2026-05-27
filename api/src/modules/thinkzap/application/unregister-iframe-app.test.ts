import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { UnregisterIframeApp } from './unregister-iframe-app'

describe('UnregisterIframeApp', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new UnregisterIframeApp()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers to resolve APP_ID and unregisters legacy iframe app', async () => {
    callMethod.mockResolvedValueOnce(77).mockResolvedValueOnce(true)

    const result = await service.execute(client, 12)

    expect(result).toBe(true)
    expect(callMethod).toHaveBeenNthCalledWith(1, 'imbot.app.register', {
      BOT_ID: 12,
      CODE: env.bitrix.iframeAudio.code,
      IFRAME: env.bitrix.iframeAudio.url,
      HASH: env.bitrix.iframeAudio.hash,
      CONTEXT: 'LINES',
    })
    expect(callMethod).toHaveBeenNthCalledWith(2, 'imbot.app.unregister', {
      APP_ID: 77,
    })
  })

  it('returns false when register does not return APP_ID', async () => {
    callMethod.mockResolvedValueOnce(0)

    const result = await service.execute(client, 12)

    expect(result).toBe(false)
    expect(callMethod).toHaveBeenCalledTimes(1)
  })

  it('returns false when unregister fails', async () => {
    callMethod
      .mockResolvedValueOnce(77)
      .mockRejectedValueOnce(new Error('not found'))

    const result = await service.execute(client, 12)

    expect(result).toBe(false)
  })
})
