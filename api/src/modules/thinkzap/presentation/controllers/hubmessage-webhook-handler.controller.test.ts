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

/**
 * O callback de status (`MESSAGE_DELIVERY`) chega na MESMA URL da mensagem recebida, e
 * sem `sender` nem `messageEventType` — antes desta change ele caía no descarte de
 * "payload inesperado", que é o que escondia a recusa da Meta.
 */
describe('HubmessageWebhookHandlerController — callback de status', () => {
  const statusMessage = {
    _id: '01A015EEAFCA741A85FDD86E205BDD18',
    tenant: '3F1B5A0A4127610747935AE2A3968FD3',
    channel_id: '40A14E4772D74EB78957CF0E407E695C',
    created: 0,
    recipient: { identifier: '554388092447', name: '554388092447' },
    contents: [
      {
        identifier: '01A015EEB14273958125503BA647334C',
        internal_information: {
          integration_id: '01A015EEAFCA741A85FDD86E205BDD18',
        },
        moment: 1787074359618,
        phone: '554388092447',
        state: {
          '@class': '.Failed',
          failedDescription:
            'Integration with meta-whatsapp failed (HTTP 400): {"details":"WhatsApp provided number needs display name approval before message can be sent."}',
          name: 'ERROR',
        },
        type: 'ErrorCallback',
      },
    ],
    media_webhook_processed: false,
  }

  beforeEach(() => vi.clearAllMocks())

  it('enfileira com source próprio e jobId do identifier da transição', async () => {
    const response = await perform({ message: statusMessage })

    expect(response.status).toBe(200)
    expect(enqueueMock).toHaveBeenCalledTimes(1)

    const [job, opts] = enqueueMock.mock.calls[0] as [
      { source: string; type: string; body: unknown },
      { jobId: string },
    ]

    expect(job).toMatchObject({
      source: 'hubmessage-status',
      type: 'ErrorCallback',
      body: statusMessage,
    })
    /**
     * Namespace próprio: o inbound usa `hubmessage-<_id>` e aqui o `_id` é o da
     * mensagem ENVIADA. Colidir colapsaria eventos de significados diferentes.
     */
    expect(opts.jobId).toBe(
      'hubmessage-status-01A015EEB14273958125503BA647334C',
    )
    expect(opts.jobId).not.toContain(':')
  })

  it('sem identifier na transição, cai para o id da mensagem', async () => {
    await perform({
      message: {
        ...statusMessage,
        contents: [{ state: { name: 'ERROR' } }],
      },
    })

    const [, opts] = enqueueMock.mock.calls[0] as [unknown, { jobId: string }]
    expect(opts.jobId).toBe(`hubmessage-status-${statusMessage._id}`)
  })

  it('estado de sucesso também é enfileirado (o processor decide)', async () => {
    await perform({
      message: {
        ...statusMessage,
        contents: [{ identifier: 'ST-9', state: { name: 'DELIVERED' } }],
      },
    })

    const [job] = enqueueMock.mock.calls[0] as [{ source: string }]
    expect(job.source).toBe('hubmessage-status')
  })

  it('mensagem recebida continua indo para o caminho de inbound', async () => {
    await perform({ message: baseMessage, messageEventType: 'NEW_MESSAGE' })

    const [job] = enqueueMock.mock.calls[0] as [{ source: string }]
    expect(job.source).toBe('hubmessage')
  })
})
