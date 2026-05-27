import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SendWidgetMessageMultipartController } from './send-widget-message-multipart.controller'
import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'

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
        connectorId: 'c1',
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
        connectorId: 'c1',
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
        connectorId: 'c1',
        destination: '5511999999999',
        message: 'Oi',
        entity: 'deal',
        entityId: '1',
        attachmentsMeta: JSON.stringify([{ kind: 'audio', name: 'a.webm' }]),
      },
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
        connectorId: 'c1',
        attachments: [
          expect.objectContaining({
            kind: 'audio',
            content: 'data:audio/mpeg;base64,bXAz',
          }),
        ],
      }),
    )
  })
})
