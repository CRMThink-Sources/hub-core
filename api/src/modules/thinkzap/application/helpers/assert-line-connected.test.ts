import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { apiLogger } from '@/shared/infra/logger'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { assertLineConnected } from './assert-line-connected'

const line = { zApiInstanceId: 'Z-1', zApiInstanceToken: 'TOKEN-SECRETO' }

describe('assertLineConnected', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não lança quando a linha está conectada', async () => {
    const getInstance = vi.fn().mockResolvedValue({ connected: true })

    await expect(
      assertLineConnected({ getInstance }, line, 'i1'),
    ).resolves.toBeUndefined()

    expect(getInstance).toHaveBeenCalledWith('Z-1', 'TOKEN-SECRETO')
  })

  it('lança LineDisconnectedError quando a linha está desconectada', async () => {
    const getInstance = vi.fn().mockResolvedValue({ connected: false })

    await expect(
      assertLineConnected({ getInstance }, line, 'i1'),
    ).rejects.toBeInstanceOf(LineDisconnectedError)
  })

  it('carrega o id do item no erro, para o front discriminar a linha', async () => {
    const getInstance = vi.fn().mockResolvedValue({ connected: false })

    await expect(
      assertLineConnected({ getInstance }, line, 'i1'),
    ).rejects.toMatchObject({ subscriptionItemId: 'i1' })
  })

  /**
   * O ponto do helper: status ilegível **não** é desconexão. Recusar aqui impediria
   * envio válido por causa de um blip do provider.
   */
  it('não lança quando a leitura falha, e registra warn', async () => {
    const getInstance = vi
      .fn()
      .mockRejectedValue(new Error('Failed to get instance data'))

    await expect(
      assertLineConnected({ getInstance }, line, 'i1'),
    ).resolves.toBeUndefined()

    expect(apiLogger.warn).toHaveBeenCalled()
  })
})
