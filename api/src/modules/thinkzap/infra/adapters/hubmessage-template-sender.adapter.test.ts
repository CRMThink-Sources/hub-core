/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { TemplateProviderUnavailableError } from '@/modules/thinkzap/domain/ports/template-errors'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import type { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { HubMessageTemplateSender } from './hubmessage-template-sender.adapter'

function makeClient(overrides: Partial<HubMessageClient> = {}) {
  return {
    sendTemplateMessage: vi.fn().mockResolvedValue({ messageId: 'msg_1' }),
    ...overrides,
  } as unknown as HubMessageClient
}

function makeSender(client: HubMessageClient) {
  return new HubMessageTemplateSender(client, {
    channelId: 'chan_1',
    recipientIdentifier: '5511999999999',
  })
}

describe('HubMessageTemplateSender', () => {
  it('supportsTemplateSend é true', () => {
    expect(makeSender(makeClient()).supportsTemplateSend).toBe(true)
  })

  it('envia o template pelo canal e devolve o messageId do provider', async () => {
    const client = makeClient()

    const result = await makeSender(client).send({
      templateName: 'order_update',
      language: 'pt_BR',
      bodyParameters: ['Maria'],
    })

    expect(client.sendTemplateMessage).toHaveBeenCalledWith('chan_1', {
      recipient: { identifier: '5511999999999' },
      content: {
        type: 'TEMPLATE',
        attachments: [
          {
            template: {
              name: 'order_update',
              language: { policy: 'deterministic', code: 'pt_BR' },
              components: [
                {
                  type: 'BODY',
                  parameters: [{ type: 'text', text: 'Maria' }],
                },
              ],
            },
          },
        ],
      },
    })
    expect(result).toEqual({ messageId: 'msg_1' })
  })

  it('preserva a ordem posicional dos parâmetros', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'order_update',
      language: 'pt_BR',
      bodyParameters: ['primeiro', 'segundo', 'terceiro'],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(
      params?.content.attachments[0]?.template.components?.[0]?.parameters,
    ).toEqual([
      { type: 'text', text: 'primeiro' },
      { type: 'text', text: 'segundo' },
      { type: 'text', text: 'terceiro' },
    ])
  })

  it('omite components quando o template não tem variável', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'welcome',
      language: 'pt_BR',
      bodyParameters: [],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template).not.toHaveProperty(
      'components',
    )
  })

  it('acrescenta o botão de link dinâmico com o index da posição no template', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'order_shipped',
      language: 'pt_BR',
      bodyParameters: ['PED-1'],
      buttonParameters: [{ index: 1, subType: 'URL', value: 'PED-1' }],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template.components).toEqual([
      { type: 'BODY', parameters: [{ type: 'text', text: 'PED-1' }] },
      {
        type: 'BUTTON',
        sub_type: 'url',
        index: '1',
        parameters: [{ type: 'text', text: 'PED-1' }],
      },
    ])
  })

  it('monta HEADER de imagem antes de BODY e BUTTON', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'promo',
      language: 'pt_BR',
      bodyParameters: ['Ana'],
      buttonParameters: [{ index: 0, subType: 'URL', value: 'PED-1' }],
      headerImageUrl: 'https://loja.com/a.png',
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template.components).toEqual([
      {
        type: 'HEADER',
        parameters: [
          { type: 'image', image: { link: 'https://loja.com/a.png' } },
        ],
      },
      { type: 'BODY', parameters: [{ type: 'text', text: 'Ana' }] },
      {
        type: 'BUTTON',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: 'PED-1' }],
      },
    ])
  })

  it('envia só o HEADER em template de imagem sem variável', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'promo',
      language: 'pt_BR',
      bodyParameters: [],
      headerImageUrl: 'https://loja.com/a.png',
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template.components).toEqual([
      {
        type: 'HEADER',
        parameters: [
          { type: 'image', image: { link: 'https://loja.com/a.png' } },
        ],
      },
    ])
  })

  it('envia o código do cupom em botão de copiar código', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'promo',
      language: 'pt_BR',
      bodyParameters: [],
      buttonParameters: [{ index: 0, subType: 'COPY_CODE', value: 'BLACK10' }],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template.components).toEqual([
      {
        type: 'BUTTON',
        sub_type: 'copy_code',
        index: '0',
        parameters: [{ type: 'coupon_code', coupon_code: 'BLACK10' }],
      },
    ])
  })

  it('omite components sem variável e com lista de botões vazia', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'welcome',
      language: 'pt_BR',
      bodyParameters: [],
      buttonParameters: [],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template).not.toHaveProperty(
      'components',
    )
  })

  /**
   * `deterministic` e não `policy` ausente: o fallback de idioma da Meta enviaria
   * outra versão aprovada do template, e o contato receberia texto diferente do que o
   * operador viu no preview.
   */
  it('fixa a política de idioma como deterministic', async () => {
    const client = makeClient()

    await makeSender(client).send({
      templateName: 'order_update',
      language: 'pt_BR',
      bodyParameters: [],
    })

    const params = vi.mocked(client.sendTemplateMessage).mock.calls[0]?.[1]
    expect(params?.content.attachments[0]?.template.language).toEqual({
      policy: 'deterministic',
      code: 'pt_BR',
    })
  })

  it('propaga a recusa do provider com a mensagem original', async () => {
    const apiError = new HubMessageApiError(
      422,
      'POST',
      '/v1/channels/chan_1/messages',
      { message: 'template not found' },
      new Error('boom'),
    )
    const client = makeClient({
      sendTemplateMessage: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<HubMessageClient>)

    await expect(
      makeSender(client).send({
        templateName: 'inexistente',
        language: 'pt_BR',
        bodyParameters: [],
      }),
    ).rejects.toThrow('template not found')
  })

  /**
   * Caso real: `502 {"error":"barling returned status 502"}`. O operador não tem ação
   * sobre o nome de um serviço interno da HubMessage.
   */
  it('traduz indisponibilidade do provider em erro de domínio', async () => {
    const apiError = new HubMessageApiError(
      502,
      'POST',
      '/v1/channels/chan_1/messages',
      { error: 'barling returned status 502' },
      new Error('boom'),
    )
    const client = makeClient({
      sendTemplateMessage: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<HubMessageClient>)

    const promise = makeSender(client).send({
      templateName: 'order_update',
      language: 'pt_BR',
      bodyParameters: [],
    })

    await expect(promise).rejects.toBeInstanceOf(
      TemplateProviderUnavailableError,
    )
    await expect(promise).rejects.toThrow('temporariamente indisponível')
  })

  it('preserva a mensagem crua do provider no erro de domínio', async () => {
    const apiError = new HubMessageApiError(
      502,
      'POST',
      '/v1/channels/chan_1/messages',
      { error: 'barling returned status 502' },
      new Error('boom'),
    )
    const client = makeClient({
      sendTemplateMessage: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<HubMessageClient>)

    await makeSender(client)
      .send({
        templateName: 'order_update',
        language: 'pt_BR',
        bodyParameters: [],
      })
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(TemplateProviderUnavailableError)
        expect(
          (error as TemplateProviderUnavailableError).providerMessage,
        ).toContain('barling returned status 502')
      })
  })
})
