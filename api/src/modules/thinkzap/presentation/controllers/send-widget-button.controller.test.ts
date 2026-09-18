import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import {
  ButtonChannelNotConnectedError,
  ButtonProviderUnavailableError,
  UnsupportedButtonTypeError,
} from '@/modules/thinkzap/domain/ports/button-errors'
import type { EnqueueWidgetButtonUseCase } from '@/modules/thinkzap/application/enqueue-widget-button.use-case'
import { SendWidgetButtonController } from './send-widget-button.controller'

const fullBody = {
  subscriptionItemId: 'item_1',
  destination: '5511999999999',
  body: 'Como podemos ajudar?',
  buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
  entity: 'deal',
  entityId: '42',
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    body: { ...fullBody, ...overrides },
    domainId: 'domain_1',
    appId: 'crmthink.thinkzap',
    bitrixUserId: '7',
  } as unknown as Request
}

const res = {} as Response

function makeController(execute: ReturnType<typeof vi.fn>) {
  return new SendWidgetButtonController({
    execute,
  } as unknown as EnqueueWidgetButtonUseCase)
}

describe('SendWidgetButtonController', () => {
  it('responde 202 com a intenção enfileirada', async () => {
    const execute = vi.fn().mockResolvedValue({
      clientMessageId: 'c1',
      status: 'queued',
      destination: '5511999999999',
    })
    const controller = makeController(execute)

    const response = await controller.perform(makeReq(), res)

    expect(response.status).toBe(202)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionItemId: 'item_1',
        domainId: 'domain_1',
        appCode: 'crmthink.thinkzap',
        operatorBitrixUserId: '7',
      }),
    )
  })

  it('recusa corpo inválido antes de chamar o use case', async () => {
    const execute = vi.fn()
    const controller = makeController(execute)

    const response = await controller.perform(makeReq({ buttons: [] }), res)

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('recusa botão CALL sem telefone', async () => {
    const execute = vi.fn()
    const controller = makeController(execute)

    const response = await controller.perform(
      makeReq({ buttons: [{ id: '1', label: 'Ligar', type: 'CALL' }] }),
      res,
    )

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('traduz UnsupportedButtonTypeError em 400', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new UnsupportedButtonTypeError('HUBMESSAGE', 'REPLY'))
    const controller = makeController(execute)

    const response = await controller.perform(makeReq(), res)

    expect(response.status).toBe(400)
  })

  it('traduz ButtonChannelNotConnectedError em 400', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new ButtonChannelNotConnectedError('item_1'))
    const controller = makeController(execute)

    const response = await controller.perform(makeReq(), res)

    expect(response.status).toBe(400)
  })

  it('traduz ButtonProviderUnavailableError em 503', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new ButtonProviderUnavailableError('boom'))
    const controller = makeController(execute)

    const response = await controller.perform(makeReq(), res)

    expect(response.status).toBe(503)
  })

  it('cai no mapeamento genérico para LineBlockedError', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new LineBlockedError('item_1', 'inactive'))
    const controller = makeController(execute)

    const response = await controller.perform(makeReq(), res)

    expect(response.status).toBe(402)
  })
})
