import { beforeEach, describe, expect, it, vi } from 'vitest'

const { axiosGetMock, convertToMp3Mock } = vi.hoisted(() => ({
  axiosGetMock: vi.fn().mockResolvedValue({ data: Buffer.from('ogg-audio') }),
  convertToMp3Mock: vi.fn().mockResolvedValue(Buffer.from('mp3-audio')),
}))

vi.mock('axios', () => ({
  default: { get: axiosGetMock },
}))

vi.mock('@/shared/helpers/convert-to-mp3', () => ({
  convertToMp3: convertToMp3Mock,
}))

import { ZApiOutboundSender } from './z-api-outbound-sender.adapter'

const config = {
  instanceId: 'INST-A',
  instanceToken: 'token',
  phone: '5511999999999',
}

function makeClient() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'ZAPI-1' }),
    sendImage: vi.fn().mockResolvedValue({ messageId: 'ZAPI-IMG' }),
    sendVideo: vi.fn().mockResolvedValue({ messageId: 'ZAPI-VID' }),
    sendAudio: vi.fn().mockResolvedValue({ messageId: 'ZAPI-AUD' }),
    sendDocument: vi.fn().mockResolvedValue({ messageId: 'ZAPI-DOC' }),
  }
}

describe('ZApiOutboundSender', () => {
  beforeEach(() => {
    axiosGetMock.mockClear()
    convertToMp3Mock.mockClear()
  })

  it('suporta reply', () => {
    const sender = new ZApiOutboundSender(makeClient() as never, config)
    expect(sender.supportsReply).toBe(true)
  })

  it('texto chama sendMessage com o telefone e devolve messageId', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({ kind: 'text', text: 'Ola' })

    expect(client.sendMessage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'Ola',
      '5511999999999',
      { referencedMessageId: undefined },
    )
    expect(result).toEqual({
      messageId: 'ZAPI-1',
      persistedType: 'TEXT',
      sentText: 'Ola',
    })
  })

  it('texto repassa referencedMessageId ao Z-API', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    await sender.send({ kind: 'text', text: 'Ola' }, {
      referencedMessageId: 'ZAPI-ANTERIOR',
    })

    expect(client.sendMessage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'Ola',
      '5511999999999',
      { referencedMessageId: 'ZAPI-ANTERIOR' },
    )
  })

  it('imagem chama sendImage com a URL', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({
      kind: 'image',
      url: 'http://x/photo.jpg',
    })

    expect(client.sendImage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/photo.jpg',
      '5511999999999',
    )
    expect(result.persistedType).toBe('IMAGE')
    expect(result.messageId).toBe('ZAPI-IMG')
  })

  it('video chama sendVideo com a URL', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({ kind: 'video', url: 'http://x/v.mp4' })

    expect(client.sendVideo).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/v.mp4',
      '5511999999999',
    )
    expect(result.persistedType).toBe('VIDEO')
  })

  it('documento chama sendDocument com URL e fileName', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({
      kind: 'document',
      url: 'http://x/contrato.pdf',
      fileName: 'contrato.pdf',
    })

    expect(client.sendDocument).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/contrato.pdf',
      '5511999999999',
      'contrato.pdf',
    )
    expect(result.persistedType).toBe('DOCUMENT')
  })

  // Guarda de regressão do transcode: o Z-API aceita payload embutido, então o
  // áudio precisa continuar sendo baixado e convertido para mp3/base64 aqui.
  it('audio baixa, converte para mp3 e envia base64', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({ kind: 'audio', url: 'http://x/a.ogg' })

    expect(axiosGetMock).toHaveBeenCalledWith('http://x/a.ogg', {
      responseType: 'arraybuffer',
    })
    expect(convertToMp3Mock).toHaveBeenCalledTimes(1)

    const [, , sentAudio] = client.sendAudio.mock.calls[0] as string[]
    expect(sentAudio).toBe(
      `data:audio/mpeg;base64,${Buffer.from('mp3-audio').toString('base64')}`,
    )
    expect(result.persistedType).toBe('AUDIO')
  })
})
