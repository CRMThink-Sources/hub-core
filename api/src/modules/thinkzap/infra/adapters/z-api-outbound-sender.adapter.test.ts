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

  /**
   * A resposta do operador a um contato em modo privacidade.
   *
   * O destino é o `chat.id` do canal aberto, que passou a ser o LID. A Z-API aceita LID
   * no lugar do telefone no campo `phone` — é o mecanismo documentado por eles, e é o
   * que permite a identidade por LID sem quebrar a direção de saída. O adapter não pode
   * tentar "consertar" o valor: qualquer normalização aqui erraria o destino.
   */
  it('encaminha o lid verbatim como destino, sem tentar normalizar', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, {
      ...config,
      phone: '3577724534928@lid',
    })

    await sender.send({ kind: 'text', text: 'oi' })

    expect(client.sendMessage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'oi',
      '3577724534928@lid',
      expect.anything(),
    )
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

    await sender.send(
      { kind: 'text', text: 'Ola' },
      {
        referencedMessageId: 'ZAPI-ANTERIOR',
      },
    )

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
      { caption: undefined },
    )
    expect(result.persistedType).toBe('IMAGE')
    expect(result.messageId).toBe('ZAPI-IMG')
    // Sem legenda não há texto a persistir — a coluna `text` continua nula.
    expect(result.sentText).toBeUndefined()
  })

  it('imagem com legenda repassa caption e devolve sentText', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({
      kind: 'image',
      url: 'http://x/photo.jpg',
      text: 'olha isso',
    })

    expect(client.sendImage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/photo.jpg',
      '5511999999999',
      { caption: 'olha isso' },
    )
    expect(result).toEqual({
      messageId: 'ZAPI-IMG',
      persistedType: 'IMAGE',
      sentText: 'olha isso',
    })
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
      { caption: undefined },
    )
    expect(result.persistedType).toBe('VIDEO')
  })

  it('video com legenda repassa caption', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({
      kind: 'video',
      url: 'http://x/v.mp4',
      text: 'veja',
    })

    expect(client.sendVideo).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/v.mp4',
      '5511999999999',
      { caption: 'veja' },
    )
    expect(result.sentText).toBe('veja')
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
      { caption: undefined },
    )
    expect(result.persistedType).toBe('DOCUMENT')
  })

  it('documento com legenda repassa caption', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    const result = await sender.send({
      kind: 'document',
      url: 'http://x/contrato.pdf',
      fileName: 'contrato.pdf',
      text: 'segue o contrato',
    })

    expect(client.sendDocument).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/contrato.pdf',
      '5511999999999',
      'contrato.pdf',
      { caption: 'segue o contrato' },
    )
    expect(result.sentText).toBe('segue o contrato')
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

  // Robô "Enviar mensagem": o arquivo já chega baixado, como data URL.
  it('audio em data URL converte sem baixar', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)
    const ogg = Buffer.from('ogg-from-robot')

    await sender.send({
      kind: 'audio',
      url: `data:audio/ogg;base64,${ogg.toString('base64')}`,
    })

    expect(axiosGetMock).not.toHaveBeenCalled()
    expect(convertToMp3Mock).toHaveBeenCalledWith(ogg)
    expect(client.sendAudio).toHaveBeenCalledTimes(1)
  })

  it('audio em data URL sem base64 é recusado sem baixar nem enviar', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)

    await expect(
      sender.send({ kind: 'audio', url: 'data:audio/ogg,texto-cru' }),
    ).rejects.toThrow('Invalid audio payload')

    expect(axiosGetMock).not.toHaveBeenCalled()
    expect(convertToMp3Mock).not.toHaveBeenCalled()
    expect(client.sendAudio).not.toHaveBeenCalled()
  })

  it('video em data URL vai ao Z-API como está, com legenda', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)
    const video = 'data:video/mp4;base64,dmlk'

    const result = await sender.send({
      kind: 'video',
      url: video,
      text: 'veja',
    })

    expect(axiosGetMock).not.toHaveBeenCalled()
    expect(client.sendVideo).toHaveBeenCalledWith(
      'INST-A',
      'token',
      video,
      '5511999999999',
      { caption: 'veja' },
    )
    expect(result.persistedType).toBe('VIDEO')
  })

  it('imagem e documento em data URL vão ao Z-API como estão', async () => {
    const client = makeClient()
    const sender = new ZApiOutboundSender(client as never, config)
    const image = 'data:image/png;base64,aW1n'
    const document = 'data:application/pdf;base64,cGRm'

    await sender.send({ kind: 'image', url: image, text: 'legenda' })
    await sender.send({
      kind: 'document',
      url: document,
      fileName: 'proposta.pdf',
    })

    expect(axiosGetMock).not.toHaveBeenCalled()
    expect(client.sendImage).toHaveBeenCalledWith(
      'INST-A',
      'token',
      image,
      '5511999999999',
      { caption: 'legenda' },
    )
    expect(client.sendDocument).toHaveBeenCalledWith(
      'INST-A',
      'token',
      document,
      '5511999999999',
      'proposta.pdf',
      { caption: undefined },
    )
  })
})
