import { beforeEach, describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import { GetLineStatusForWidget } from '@/modules/thinkzap/application/get-line-status-for-widget'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { GetLineStatusForWidgetController } from './get-line-status-for-widget.controller'

/** Marcas sintéticas: qualquer uma no payload é vazamento, não coincidência. */
const SECRETS = ['TOKEN-ZAPI-SUPER-SECRETO', '5511999998888']

const req = {
  params: { subscriptionItemId: 'i1' },
  domainId: 'domain-1',
  appId: 'crmthink.thinkzap',
} as unknown as Request

describe('GetLineStatusForWidgetController', () => {
  const execute = vi.fn()
  const controller = new GetLineStatusForWidgetController({
    execute,
  } as unknown as GetLineStatusForWidget)

  beforeEach(() => {
    vi.clearAllMocks()
    execute.mockResolvedValue({ connected: true, available: true })
  })

  it('responde 200 com os dois booleanos', async () => {
    const response = await controller.perform(req)

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ connected: true, available: true })
  })

  it('escopa a leitura pelo par (domainId, appCode) do token', async () => {
    await controller.perform(req)

    expect(execute).toHaveBeenCalledWith({
      subscriptionItemId: 'i1',
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('responde 200 com available: false quando a leitura degradou', async () => {
    execute.mockResolvedValue({ connected: false, available: false })

    const response = await controller.perform(req)

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ connected: false, available: false })
  })

  /**
   * O risco desta rota: ela é aberta a qualquer usuário Bitrix com JWT, e o caso de
   * uso está a um spread de distância de emitir a instância crua da Z-API — que
   * carrega `token`.
   */
  describe('redação da resposta', () => {
    it('não emite credencial, telefone nem a instância do provider', async () => {
      execute.mockResolvedValue({
        connected: true,
        available: true,
        // Campos que um `...status` traria de volta se alguém trocasse a montagem
        // campo por campo por um spread.
        instance: { token: 'TOKEN-ZAPI-SUPER-SECRETO', connected: true },
        zApiInstanceToken: 'TOKEN-ZAPI-SUPER-SECRETO',
        phone: { phone: '5511999998888' },
      })

      const response = await controller.perform(req)
      const serialized = JSON.stringify(response.result)

      for (const secret of SECRETS) {
        expect(serialized).not.toContain(secret)
      }
      expect(response.result).toEqual({ connected: true, available: true })
      expect(Object.keys(response.result as object)).toEqual([
        'connected',
        'available',
      ])
    })
  })

  it('traduz item fora da instalação para 404', async () => {
    execute.mockRejectedValue(new LineNotFoundError('i9'))

    const response = await controller.perform(req)

    expect(response.status).toBe(404)
  })

  it('traduz linha bloqueada para 402 com code line-blocked', async () => {
    execute.mockRejectedValue(new LineBlockedError('i1', 'trial-expired'))

    const response = await controller.perform(req)

    expect(response.status).toBe(402)
    expect(response.result).toMatchObject({
      code: 'line-blocked',
      entitlement: 'trial-expired',
    })
  })

  it('traduz provider não suportado para 400', async () => {
    execute.mockRejectedValue(new LineProviderNotSupportedError('HUBMESSAGE'))

    const response = await controller.perform(req)

    expect(response.status).toBe(400)
  })

  /** Erro desconhecido sobe: `Controller.handle` responde `500` e loga. */
  it('propaga erro inesperado', async () => {
    execute.mockRejectedValue(new Error('boom'))

    await expect(controller.perform(req)).rejects.toThrow('boom')
  })
})
