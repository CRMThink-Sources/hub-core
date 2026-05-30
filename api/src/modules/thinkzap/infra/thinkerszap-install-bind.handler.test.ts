import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const executeBot = vi.hoisted(() => vi.fn())

vi.mock('../application/build-audio-im-textarea-placement-params', () => ({
  buildAudioImTextareaPlacementBindParams: () => ({
    PLACEMENT: 'IM_TEXTAREA',
    HANDLER: 'https://app.example/bitrix/widget/audio',
    TITLE: 'ThinkZap Audio',
    LANG_ALL: { pt: { TITLE: 'ThinkZap Audio' } },
    OPTIONS: { iconName: 'chat-compose', context: 'LINES' },
  }),
}))

vi.mock('../application/get-or-create-thinkzap-bot', () => ({
  GetOrCreateThinkzapBot: class {
    execute = executeBot
  },
}))

import { ThinkersZapInstallBindHandler } from './thinkerszap-install-bind.handler'

describe('ThinkersZapInstallBindHandler', () => {
  const handler = new ThinkersZapInstallBindHandler()
  const client = {} as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
    executeBot.mockResolvedValue(42)
  })

  it('includes IM_TEXTAREA placement bind in static binds', () => {
    const binds = handler.getBinds()
    const audioBind = binds.find(
      bind =>
        bind.method === 'placement.bind' &&
        bind.params.PLACEMENT === 'IM_TEXTAREA',
    )

    expect(audioBind).toBeDefined()
    expect(audioBind?.params).toMatchObject({
      PLACEMENT: 'IM_TEXTAREA',
      OPTIONS: expect.objectContaining({
        iconName: 'chat-compose',
        context: 'LINES',
      }),
    })
  })

  it('onInstall ensures Open Lines bot only', async () => {
    await handler.onInstall(client)

    expect(executeBot).toHaveBeenCalledWith(client)
  })

  it('skips bot creation failure gracefully', async () => {
    executeBot.mockResolvedValue(null)

    await expect(handler.onInstall(client)).resolves.toBeUndefined()
  })
})
