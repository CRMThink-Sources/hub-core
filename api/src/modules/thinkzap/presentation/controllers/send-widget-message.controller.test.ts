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
import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { SendWidgetMessageController } from './send-widget-message.controller'

const req = {
  body: {
    subscriptionItemId: 'i1',
    destination: '5511999999999',
    message: 'Olá',
    entity: 'deal',
    entityId: '42',
  },
  domainId: 'domain-1',
  appId: 'crmthink.thinkzap',
} as unknown as Request

describe('SendWidgetMessageController', () => {
  const execute = vi.fn()
  const controller = new SendWidgetMessageController({
    execute,
  } as unknown as SendWidgetMessageUseCase)

  beforeEach(() => {
    vi.clearAllMocks()
    execute.mockResolvedValue({
      message: 'Message sent successfully',
      destination: '5511999999999',
      sentMessageIds: ['msg-1'],
    })
  })

  it('responde 200 no envio bem-sucedido', async () => {
    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(200)
  })

  /**
   * `409` e não `402`: o direito existe, o estado não permite enviar agora. O `code`
   * porque a mensagem é interpolada com o id do item.
   */
  it('traduz linha desconectada para 409 com code line-disconnected', async () => {
    execute.mockRejectedValue(new LineDisconnectedError('i1'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(409)
    expect(response.result).toMatchObject({ code: 'line-disconnected' })
  })

  /**
   * Antes caía no `badRequest` genérico e o front perdia a distinção que
   * `extractLineBlocked` criou para as rotas de linha.
   */
  it('traduz linha bloqueada para 402 com code line-blocked', async () => {
    execute.mockRejectedValue(new LineBlockedError('i1', 'trial-expired'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(402)
    expect(response.result).toMatchObject({
      code: 'line-blocked',
      entitlement: 'trial-expired',
    })
  })

  it('traduz item fora da instalação para 404', async () => {
    execute.mockRejectedValue(new LineNotFoundError('i9'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(404)
  })

  it('traduz provider não suportado para 400', async () => {
    execute.mockRejectedValue(new LineProviderNotSupportedError('HUBMESSAGE'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(400)
  })

  it('preserva o 404 de Instance not found que já existia', async () => {
    execute.mockRejectedValue(new Error('Instance not found'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(404)
  })

  /** Falha do provider segue como `400` com a mensagem crua, como antes. */
  it('mantém 400 com a mensagem para os demais erros', async () => {
    execute.mockRejectedValue(new Error('Failed to send message to Z-API'))

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(400)
    expect(response.result).toMatchObject({
      error: 'Failed to send message to Z-API',
    })
  })
})
