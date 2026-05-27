import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const executeBot = vi.hoisted(() => vi.fn())

vi.mock('../application/get-or-create-thinkzap-bot', () => ({
  GetOrCreateThinkzapBot: class {
    execute = executeBot
  },
}))

import { ThinkersZapInstallBindHandler } from './thinkerszap-install-bind.handler'

describe('ThinkersZapInstallBindHandler', () => {
  const handler = new ThinkersZapInstallBindHandler()
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
    executeBot.mockResolvedValue(42)
  })

  it('includes IM_TEXTAREA placement bind for audio widget', () => {
    const binds = handler.getBinds()
    const audioBind = binds.find(
      bind =>
        bind.method === 'placement.bind' &&
        bind.params.PLACEMENT === 'IM_TEXTAREA',
    )

    expect(audioBind).toBeDefined()
    expect(audioBind?.params.OPTIONS).toMatchObject({
      iconName: 'fa-microphone',
      context: 'LINES',
      role: 'USER',
    })
  })

  it('onInstall only ensures Open Lines bot exists', async () => {
    await handler.onInstall(client)

    expect(executeBot).toHaveBeenCalledWith(client)
    expect(callMethod).not.toHaveBeenCalled()
  })
})
