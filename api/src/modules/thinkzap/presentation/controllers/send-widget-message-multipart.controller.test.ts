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
import { SendWidgetMessageMultipartController } from './send-widget-message-multipart.controller'
import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'

describe('SendWidgetMessageMultipartController', () => {
  const execute = vi.fn()
  const convertAudioBufferToMp3DataUrl = vi.fn()

  const useCase = {
    execute,
    convertAudioBufferToMp3DataUrl,
  } as unknown as SendWidgetMessageUseCase

  const controller = new SendWidgetMessageMultipartController(useCase)

  beforeEach(() => {
    vi.clearAllMocks()
    execute.mockResolvedValue({
      message: 'Message sent successfully',
      destination: '5511999999999',
      sentMessageIds: ['msg-1'],
    })
    convertAudioBufferToMp3DataUrl.mockResolvedValue(
      'data:audio/mpeg;base64,bXAz',
    )
  })

  it('returns 400 when attachmentsMeta is invalid JSON', async () => {
    const req = {
      body: {
        subscriptionItemId: 'i1',
        destination: '5511999999999',
        entity: 'deal',
        entityId: '1',
        attachmentsMeta: '{invalid',
      },
      files: [
        {
          buffer: Buffer.from('x'),
          originalname: 'a.webm',
          mimetype: 'audio/webm',
        },
      ],
    } as unknown as Request

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns 400 when files count does not match attachmentsMeta', async () => {
    const req = {
      body: {
        subscriptionItemId: 'i1',
        destination: '5511999999999',
        entity: 'deal',
        entityId: '1',
        attachmentsMeta: JSON.stringify([{ kind: 'audio', name: 'a.webm' }]),
      },
      files: [],
    } as unknown as Request

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('converts audio buffer to mp3 and sends message', async () => {
    const req = {
      body: {
        subscriptionItemId: 'i1',
        destination: '5511999999999',
        message: 'Oi',
        entity: 'deal',
        entityId: '1',
        attachmentsMeta: JSON.stringify([{ kind: 'audio', name: 'a.webm' }]),
      },
      bitrixUserId: '7',
      files: [
        {
          buffer: Buffer.from('webm-audio'),
          originalname: 'a.webm',
          mimetype: 'audio/webm',
        },
      ],
    } as unknown as Request

    const response = await controller.perform(req, {} as never)

    expect(response.status).toBe(200)
    expect(convertAudioBufferToMp3DataUrl).toHaveBeenCalledWith(
      Buffer.from('webm-audio'),
    )
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionItemId: 'i1',
        // Do token, nunca do corpo — é quem assina a mensagem.
        operatorBitrixUserId: '7',
        attachments: [
          expect.objectContaining({
            kind: 'audio',
            content: 'data:audio/mpeg;base64,bXAz',
          }),
        ],
      }),
    )
  })

  /**
   * Mesma tradução do envio de texto: os dois controllers compartilham
   * `mapWidgetSendError` porque responder diferente por rota faria o widget ter que
   * aprender cada uma.
   */
  describe('tradução de erro', () => {
    const validReq = {
      body: {
        subscriptionItemId: 'i1',
        destination: '5511999999999',
        entity: 'deal',
        entityId: '1',
        attachmentsMeta: JSON.stringify([{ kind: 'image', name: 'a.png' }]),
      },
      files: [
        {
          buffer: Buffer.from('png'),
          originalname: 'a.png',
          mimetype: 'image/png',
        },
      ],
    } as unknown as Request

    it('traduz linha desconectada para 409 com code line-disconnected', async () => {
      execute.mockRejectedValue(new LineDisconnectedError('i1'))

      const response = await controller.perform(validReq, {} as never)

      expect(response.status).toBe(409)
      expect(response.result).toMatchObject({ code: 'line-disconnected' })
    })

    it('traduz linha bloqueada para 402 com code line-blocked', async () => {
      execute.mockRejectedValue(new LineBlockedError('i1', 'inactive'))

      const response = await controller.perform(validReq, {} as never)

      expect(response.status).toBe(402)
      expect(response.result).toMatchObject({
        code: 'line-blocked',
        entitlement: 'inactive',
      })
    })
  })
})
