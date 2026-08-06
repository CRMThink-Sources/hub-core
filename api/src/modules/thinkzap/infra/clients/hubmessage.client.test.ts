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
    interceptors: { response: { use: vi.fn() } },
  }
  return {
    default: {
      create: vi.fn(() => instance),
      isAxiosError: vi.fn(() => false),
    },
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
    ).toThrow('token de autenticação ausente')
  })
})
