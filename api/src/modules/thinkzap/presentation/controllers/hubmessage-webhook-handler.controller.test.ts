import { beforeEach, describe, expect, it, vi } from 'vitest'

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue({ id: 'job-1' }),
}))

vi.mock('@/queue/thinkzap-inbound.queue', () => ({
  enqueueThinkzapInboundJob: enqueueMock,
}))

import { Request, Response } from 'express'
import { HubmessageWebhookHandlerController } from './hubmessage-webhook-handler.controller'

const baseMessage = {
  _id: '019F5D201EAA795BA7B46A820C7CA289',
  channel_id: '7ACA75EC493A4F3F986FD470F30FA559',
  chat_id: '7ACA75EC493A4F3F986FD470F30FA559=15553840789',
  created: 1783973813930,
  metadata: { from_me: false, moment: 1783973812000 },
  sender: { identifier: '554792259475', name: 'Romuca' },
  contents: [{ type: 'TEXT', message: 'Outra msg de teste' }],
  attachments: [],
}

function perform(body: unknown) {
  const controller = new HubmessageWebhookHandlerController()
  return controller.perform({ body } as Request, {} as Response)
}

describe('HubmessageWebhookHandlerController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enqueues a valid envelope with a jobId derived from the message id', async () => {
    const response = await perform({
      message: baseMessage,
      messageEventType: 'NEW_MESSAGE',
    })

    expect(response.status).toBe(200)
    expect(enqueueMock).toHaveBeenCalledTimes(1)

    // Tipado na desestruturação: `mock.calls` é `any[]`, e sem isto o `opts.jobId`
    // abaixo viraria acesso a `any`.
    const [job, opts] = enqueueMock.mock.calls[0] as [
      unknown,
      { jobId: string },
    ]
    expect(job).toMatchObject({
      source: 'hubmessage',
      type: 'NEW_MESSAGE',
      body: baseMessage,
    })
    expect(opts.jobId).toBe(`hubmessage-${baseMessage._id}`)
    // BullMQ rejeita ':' em jobId custom — não regredir para `hubmessage:<id>`.
    expect(opts.jobId).not.toContain(':')
  })

  it('discards messages sent by the business (from_me)', async () => {
    const response = await perform({
      message: { ...baseMessage, metadata: { from_me: true } },
      messageEventType: 'NEW_MESSAGE',
    })

    expect(response.status).toBe(200)
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('discards an unexpected payload but still answers 200', async () => {
    const response = await perform({ foo: 'bar' })

    expect(response.status).toBe(200)
    expect(enqueueMock).not.toHaveBeenCalled()
  })
})
