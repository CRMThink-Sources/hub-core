import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test' },
}))

import { HubMessageOutboundSender } from './hubmessage-outbound-sender.adapter'

const config = { channelId: 'CH-123', recipientIdentifier: '5511999999999' }

function makeClient() {
  return { sendMessage: vi.fn().mockResolvedValue({ messageId: 'HM-1' }) }
}

describe('HubMessageOutboundSender', () => {
  let client: ReturnType<typeof makeClient>
  let sender: HubMessageOutboundSender

  beforeEach(() => {
    client = makeClient()
    sender = new HubMessageOutboundSender(client as never, config)
  })

  it('não suporta reply', () => {
    expect(sender.supportsReply).toBe(false)
  })

  it('texto vira content.type TEXT com body.message', async () => {
    const result = await sender.send({ kind: 'text', text: 'Ola' })

    expect(client.sendMessage).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'TEXT', body: { message: 'Ola' } },
    })
    expect(result).toEqual({
      messageId: 'HM-1',
      persistedType: 'TEXT',
      sentText: 'Ola',
    })
  })

  it('imagem vira IMAGE com attachments[0].url', async () => {
    const result = await sender.send({
      kind: 'image',
      url: 'http://x/photo.jpg',
    })

    expect(client.sendMessage).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'IMAGE', attachments: [{ url: 'http://x/photo.jpg' }] },
    })
    expect(result.persistedType).toBe('IMAGE')
  })

  it('video vira VIDEO com attachments[0].url', async () => {
    const result = await sender.send({ kind: 'video', url: 'http://x/v.mp4' })

    expect(client.sendMessage).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'VIDEO', attachments: [{ url: 'http://x/v.mp4' }] },
    })
    expect(result.persistedType).toBe('VIDEO')
  })

  it('audio vira AUDIO com a URL direta, sem transcode', async () => {
    const result = await sender.send({ kind: 'audio', url: 'http://x/a.ogg' })

    expect(client.sendMessage).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'AUDIO', attachments: [{ url: 'http://x/a.ogg' }] },
    })
    expect(result.persistedType).toBe('AUDIO')
  })

  it('documento vira TEXT com nome e link, mas persiste como DOCUMENT', async () => {
    const result = await sender.send({
      kind: 'document',
      url: 'http://x/contrato.pdf',
      fileName: 'contrato.pdf',
    })

    const [, params] = client.sendMessage.mock.calls[0] as [
      string,
      { content: { type: string; body: { message: string } } },
    ]
    expect(params.content.type).toBe('TEXT')
    expect(params.content.body.message).toContain('contrato.pdf')
    expect(params.content.body.message).toContain('http://x/contrato.pdf')

    expect(result.persistedType).toBe('DOCUMENT')
    expect(result.sentText).toContain('contrato.pdf')
  })

  it('documento sem fileName ainda envia o link', async () => {
    await sender.send({ kind: 'document', url: 'http://x/f.bin' })

    const [, params] = client.sendMessage.mock.calls[0] as [
      string,
      { content: { body: { message: string } } },
    ]
    expect(params.content.body.message).toContain('http://x/f.bin')
  })

  it('referencedMessageId é ignorado e não vaza para o payload', async () => {
    await sender.send({ kind: 'text', text: 'Ola' }, {
      referencedMessageId: 'HM-ANTERIOR',
    })

    expect(client.sendMessage).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'TEXT', body: { message: 'Ola' } },
    })
    expect(JSON.stringify(client.sendMessage.mock.calls[0])).not.toContain(
      'HM-ANTERIOR',
    )
  })
})
