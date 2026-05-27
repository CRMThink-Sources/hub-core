import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const executeBot = vi.hoisted(() => vi.fn())
const ensureImbotAudioApp = vi.hoisted(() => vi.fn())

vi.mock('../application/get-or-create-thinkzap-bot', () => ({
  GetOrCreateThinkzapBot: class {
    execute = executeBot
  },
}))

vi.mock('../application/ensure-imbot-audio-app', () => ({
  ensureImbotAudioApp,
}))

import { ThinkersZapInstallBindHandler } from './thinkerszap-install-bind.handler'

describe('ThinkersZapInstallBindHandler', () => {
  const handler = new ThinkersZapInstallBindHandler()
  const client = {} as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
    executeBot.mockResolvedValue(42)
    ensureImbotAudioApp.mockResolvedValue('updated')
  })

  it('does not include IM_TEXTAREA in static binds', () => {
    const binds = handler.getBinds()
    const audioBind = binds.find(
      bind =>
        bind.method === 'placement.bind' &&
        bind.params.PLACEMENT === 'IM_TEXTAREA',
    )

    expect(audioBind).toBeUndefined()
  })

  it('onInstall ensures Open Lines bot and imbot audio app', async () => {
    await handler.onInstall(client)

    expect(executeBot).toHaveBeenCalledWith(client)
    expect(ensureImbotAudioApp).toHaveBeenCalledWith(client, 42)
  })

  it('skips imbot app when bot is not available', async () => {
    executeBot.mockResolvedValue(null)

    await handler.onInstall(client)

    expect(ensureImbotAudioApp).not.toHaveBeenCalled()
  })
})
