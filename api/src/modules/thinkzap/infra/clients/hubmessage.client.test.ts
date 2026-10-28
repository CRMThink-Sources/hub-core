import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HubMessageClient } from './hubmessage.client'

/**
 * `axios.create` é mockado para expor o `post` da instância interna. O alvo do
 * teste é o contrato HTTP que o client monta — rota e corpo — porque é
 * exatamente o que está **não confirmado** na doc do provider para envio de
 * template (ver `SendHubMessageTemplateParams`). Se a rota mudar, este teste
 * falha e denuncia onde.
 */
vi.mock('axios', () => {
  const post = vi.fn()
  const instance = {
    post,
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    /**
     * `request` além de `response`: o client registra o interceptor de log
     * (`attachProviderHttpLogging`), que mede a duração da chamada no request e a
     * consome na resposta. Mock sem `request` derruba o construtor.
     */
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  }
  return {
    default: {
      create: vi.fn(() => instance),
      isAxiosError: vi.fn(() => false),
    },
    /** O interceptor de log faz `error instanceof AxiosError`. */
    AxiosError: class AxiosError extends Error {},
  }
})

const mockedAxios = vi.mocked(axios, true)

function makeClient() {
  return new HubMessageClient({
    baseUrl: 'https://api.hubmessage.io',
    token: 'token_1',
  })
}

/** A instância que `axios.create` devolve — a mesma em todas as chamadas. */
function instance() {
  return mockedAxios.create.mock.results[0]?.value as {
    post: ReturnType<typeof vi.fn>
  }
}

describe('HubMessageClient.sendTemplateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * O corpo é asseverado inteiro, campo por campo, de propósito: este shape saiu de
   * envio real contra a API (2026-08-06) e não de documentação. Se alguém "arrumar"
   * `attachments` para `content.template`, ou `language` para string, o teste falha —
   * era o `502 {"error":"barling returned status 502"}` que isso causava.
   */
  it('envia o template dentro de content.attachments, na rota de mensagens', async () => {
    const client = makeClient()
    instance().post.mockResolvedValue({ data: { messageId: 'msg_1' } })

    await client.sendTemplateMessage('chan_1', {
      recipient: { identifier: '5543988092447' },
      content: {
        type: 'TEMPLATE',
        attachments: [
          {
            template: {
              name: 'update_3',
              language: { policy: 'deterministic', code: 'pt_BR' },
              components: [
                {
                  type: 'BODY',
                  parameters: [
                    { type: 'text', text: 'Joao' },
                    { type: 'text', text: '1234' },
                  ],
                },
              ],
            },
          },
        ],
      },
    })

    expect(instance().post).toHaveBeenCalledWith(
      '/v1/channels/chan_1/messages',
      {
        recipient: { identifier: '5543988092447' },
        content: {
          type: 'TEMPLATE',
          attachments: [
            {
              template: {
                name: 'update_3',
                language: { policy: 'deterministic', code: 'pt_BR' },
                components: [
                  {
                    type: 'BODY',
                    parameters: [
                      { type: 'text', text: 'Joao' },
                      { type: 'text', text: '1234' },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    )
  })

  it('devolve o messageId da resposta', async () => {
    const client = makeClient()
    instance().post.mockResolvedValue({ data: { messageId: 'msg_42' } })

    const result = await client.sendTemplateMessage('chan_1', {
      recipient: { identifier: '5511999999999' },
      content: {
        type: 'TEMPLATE',
        attachments: [
          {
            template: {
              name: 'welcome',
              language: { policy: 'deterministic', code: 'pt_BR' },
            },
          },
        ],
      },
    })

    expect(result).toEqual({ messageId: 'msg_42' })
  })

  it('propaga a falha da requisição', async () => {
    const client = makeClient()
    instance().post.mockRejectedValue(new Error('boom'))

    await expect(
      client.sendTemplateMessage('chan_1', {
        recipient: { identifier: '5511999999999' },
        content: {
          type: 'TEMPLATE',
          attachments: [
            {
              template: {
                name: 'welcome',
                language: { policy: 'deterministic', code: 'pt_BR' },
              },
            },
          ],
        },
      }),
    ).rejects.toThrow('boom')
  })
})

describe('HubMessageClient.cancelChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Sem `cancel=true` na query a HubMessage responde sem cancelar nada. */
  it('envia cancel=true na query e o motivo no corpo', async () => {
    const client = makeClient()
    const http = mockedAxios.create.mock.results[0]?.value as {
      delete: ReturnType<typeof vi.fn>
    }
    http.delete.mockResolvedValueOnce({ status: 204, data: '' })

    await client.cancelChannel('chan-1', 'Assinatura cancelada no CRM')

    expect(http.delete).toHaveBeenCalledWith('/v1/channels/chan-1/cancel', {
      params: { cancel: true },
      data: { cancelReason: 'Assinatura cancelada no CRM' },
    })
  })
})

describe('HubMessageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recusa construção sem token', () => {
    expect(
      () =>
        new HubMessageClient({
          baseUrl: 'https://api.hubmessage.io',
          token: '',
        }),
    ).toThrow('A integração com o WhatsApp Oficial não está configurada.')
  })
})

describe('HubMessageClient.uploadTemplateMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envia o arquivo em multipart na rota de mídia de template e devolve o h', async () => {
    const client = makeClient()
    instance().post.mockResolvedValue({ data: { h: '4::abc' } })

    const result = await client.uploadTemplateMedia('waba_1', {
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      contentType: 'image/png',
      fileName: 'header.png',
    })

    const [url, body, config] = instance().post.mock.calls[0] as [
      string,
      FormData,
      { headers: Record<string, string> },
    ]
    expect(url).toBe('/whatsapp/businesses/waba_1/templates/media')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('type')).toBe('image/png')
    const file = body.get('file') as File
    expect(file.name).toBe('header.png')
    expect(file.size).toBe(4)
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
    expect(result).toEqual({ h: '4::abc' })
  })
})

describe('HubMessageClient.subscribeChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const get = () =>
    (
      mockedAxios.create.mock.results[0]?.value as {
        get: ReturnType<typeof vi.fn>
      }
    ).get

  it('canal assinado agora é "subscribed"', async () => {
    const client = makeClient()
    get().mockResolvedValueOnce({ data: { checkoutId: 'chk_1' } })

    await expect(client.subscribeChannel('ch_1')).resolves.toBe('subscribed')
    expect(get()).toHaveBeenCalledWith('/v1/channels/ch_1/subscribe')
  })

  it('ALREADY_PAID no corpo de um 200 é "already-subscribed"', async () => {
    const client = makeClient()
    get().mockResolvedValueOnce({ data: { type: 'ALREADY_PAID' } })

    await expect(client.subscribeChannel('ch_1')).resolves.toBe(
      'already-subscribed',
    )
  })

  it('ALREADY_PAID como erro HTTP é "already-subscribed"', async () => {
    const client = makeClient()
    mockedAxios.isAxiosError.mockReturnValueOnce(true)
    get().mockRejectedValueOnce(
      Object.assign(new Error('400'), {
        response: { status: 400, data: { type: 'ALREADY_PAID' } },
      }),
    )

    await expect(client.subscribeChannel('ch_1')).resolves.toBe(
      'already-subscribed',
    )
  })
})
