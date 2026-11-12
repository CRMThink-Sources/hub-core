import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiLogger } from '@/shared/infra/logger'
import { ZApiClient } from './z-api.client'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

/** `axios.create` é mockado para expor o `post` da instância própria do client. */
vi.mock('axios', () => {
  const instance = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  }
  return {
    default: {
      create: vi.fn(() => instance),
      isAxiosError: vi.fn(() => false),
    },
    AxiosError: class AxiosError extends Error {},
  }
})

const mockedAxios = vi.mocked(axios, true)

function instance() {
  return mockedAxios.create.mock.results[0]?.value as {
    post: ReturnType<typeof vi.fn>
  }
}

describe('ZApiClient.unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chama o cancelamento on-demand da instância', async () => {
    const client = new ZApiClient('partner_token')
    instance().post.mockResolvedValueOnce({ data: undefined })

    await client.unsubscribe('inst_1', 'tok_1')

    expect(instance().post).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/inst_1/token/tok_1/integrator/on-demand/cancel',
      {},
      { headers: { Authorization: 'Bearer partner_token' } },
    )
  })

  /**
   * Código próprio, e não o do subscribe: o log de uma desassinatura falha é o único
   * lugar onde aparece um recurso que continua cobrado de nós.
   */
  it('lança o código de falha de desassinatura', async () => {
    const client = new ZApiClient('partner_token')
    instance().post.mockRejectedValueOnce(new Error('rede'))

    await expect(client.unsubscribe('inst_1', 'tok_1')).rejects.toMatchObject({
      errorCode: 'thinkzap.zapi.instance_unsubscribe_failed',
    })
  })
})

describe('ZApiClient.updateNotifySentByMe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function put() {
    return (
      mockedAxios.create.mock.results[0]?.value as {
        put: ReturnType<typeof vi.fn>
      }
    ).put
  }

  it('liga a notificação das enviadas pelo próprio número', async () => {
    const client = new ZApiClient('partner_token', 'client_tok')
    put().mockResolvedValueOnce({ data: { value: true } })

    await client.updateNotifySentByMe('inst_1', 'tok_1', true)

    expect(put()).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/inst_1/token/tok_1/update-notify-sent-by-me',
      { notifySentByMe: true },
      { headers: { 'Client-Token': 'client_tok' } },
    )
  })

  it('lança o código próprio na falha', async () => {
    const client = new ZApiClient('partner_token')
    put().mockRejectedValueOnce(new Error('rede'))

    await expect(
      client.updateNotifySentByMe('inst_1', 'tok_1', false),
    ).rejects.toMatchObject({
      errorCode: 'thinkzap.zapi.notify_sent_by_me_failed',
    })
  })
})

describe('ZApiClient.phoneExists', () => {
  type Http = { get: ReturnType<typeof vi.fn> }
  const warn = () => vi.mocked(apiLogger.warn)

  beforeEach(() => {
    warn().mockClear()
  })

  it('manda o telefone no caminho, não em query (query devolve NOT_FOUND com 200)', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as Http
    http.get.mockResolvedValue({
      data: [{ exists: true, phone: '5541991147662', lid: '1@lid' }],
    })

    const result = await client.phoneExists('inst_1', 'tok_1', '5541991147662')

    const [url, config] = http.get.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(url).toBe(
      'https://api.z-api.io/instances/inst_1/token/tok_1/phone-exists/5541991147662',
    )
    expect(config).not.toHaveProperty('params')
    expect(result).toEqual({
      exists: true,
      phone: '5541991147662',
      lid: '1@lid',
    })
    expect(warn()).not.toHaveBeenCalled()
  })

  it('corpo de erro com HTTP 200 vira null e é logado, não "sem LID"', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as Http
    http.get.mockResolvedValue({
      data: { error: 'NOT_FOUND', message: 'Unable to find matching target' },
    })

    await expect(
      client.phoneExists('inst_1', 'tok_1', '5541991147662'),
    ).resolves.toBeNull()
    expect(warn()).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'corpo_de_erro_com_http_200' }),
      expect.any(String),
    )
  })

  it('número sem WhatsApp devolve o resultado e loga o motivo', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as Http
    http.get.mockResolvedValue({
      data: [{ exists: false, phone: '5541991147662', lid: null }],
    })

    const result = await client.phoneExists('inst_1', 'tok_1', '5541991147662')

    expect(result).toMatchObject({ exists: false, lid: null })
    expect(warn()).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'numero_sem_whatsapp' }),
      expect.any(String),
    )
  })

  it('existe mas sem lid loga resposta_sem_lid', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as Http
    http.get.mockResolvedValue({
      data: [{ exists: true, phone: '5541991147662', lid: null }],
    })

    await client.phoneExists('inst_1', 'tok_1', '5541991147662')

    expect(warn()).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'resposta_sem_lid' }),
      expect.any(String),
    )
  })

  it('o token nunca aparece no log', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as Http
    http.get.mockResolvedValue({ data: { error: 'NOT_FOUND' } })

    await client.phoneExists('inst_1', 'tok_secreto', '5541991147662')

    expect(JSON.stringify(warn().mock.calls)).not.toContain('tok_secreto')
  })
})

describe('ZApiClient.subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assinatura nova (ou cancelamento agendado desfeito) é "subscribed"', async () => {
    const client = new ZApiClient('partner_token')
    instance().post.mockResolvedValueOnce({
      data: { subscriptionStatus: 'PROCESSING' },
    })

    await expect(client.subscribe('inst_1', 'tok_1')).resolves.toBe(
      'subscribed',
    )
  })

  it('instância já paga é "already-subscribed"', async () => {
    const client = new ZApiClient('partner_token')
    const error = Object.assign(new Error('400'), {
      response: { status: 400, data: { subscriptionStatus: 'ALREADY_ACTIVE' } },
    })
    mockedAxios.isAxiosError.mockReturnValueOnce(true)
    instance().post.mockRejectedValueOnce(error)

    await expect(client.subscribe('inst_1', 'tok_1')).resolves.toBe(
      'already-subscribed',
    )
  })
})

describe('ZApiClient.editMessage / deleteMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('edita chamando send-message-edit com o texto novo', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as {
      post: ReturnType<typeof vi.fn>
    }
    http.post.mockResolvedValue({ data: {} })

    await client.editMessage('inst', 'tok', '5511', 'MSG1', 'novo texto')

    expect(http.post).toHaveBeenCalledTimes(1)
    const [url, body] = http.post.mock.calls[0] as [string, unknown]
    expect(url).toContain('/send-message-edit')
    expect(body).toEqual({
      messageId: 'MSG1',
      phone: '5511',
      message: 'novo texto',
    })
  })

  it('apaga chamando DELETE /messages com messageId, phone e owner=true', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as {
      delete: ReturnType<typeof vi.fn>
    }
    http.delete.mockResolvedValue({ data: { value: true } })

    await client.deleteMessage('inst', 'tok', '5511', 'MSG1')

    const [url, config] = http.delete.mock.calls[0] as [
      string,
      { params: unknown },
    ]
    expect(url.endsWith('/messages')).toBe(true)
    expect(config.params).toEqual({
      messageId: 'MSG1',
      phone: '5511',
      owner: true,
    })
  })

  it.each([[{ value: false }], [{}], [undefined]])(
    '200 sem value:true não é sucesso (%j)',
    async data => {
      const client = new ZApiClient('partner', 'client')
      const http = instance() as unknown as {
        delete: ReturnType<typeof vi.fn>
      }
      http.delete.mockResolvedValue({ data })

      await expect(
        client.deleteMessage('inst', 'tok', '5511', 'MSG1'),
      ).rejects.toMatchObject({
        errorCode: 'thinkzap.zapi.message_delete_failed',
      })
    },
  )

  it('edição que falha sobe o erro tipado de edição', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as { post: ReturnType<typeof vi.fn> }
    http.post.mockRejectedValue(new Error('boom'))

    await expect(
      client.editMessage('inst', 'tok', '5511', 'MSG1', 'x'),
    ).rejects.toMatchObject({ errorCode: 'thinkzap.zapi.message_edit_failed' })
  })

  it('exclusão que falha sobe o erro tipado de exclusão', async () => {
    const client = new ZApiClient('partner', 'client')
    const http = instance() as unknown as { delete: ReturnType<typeof vi.fn> }
    http.delete.mockRejectedValue(new Error('boom'))

    await expect(
      client.deleteMessage('inst', 'tok', '5511', 'MSG1'),
    ).rejects.toMatchObject({
      errorCode: 'thinkzap.zapi.message_delete_failed',
    })
  })
})
