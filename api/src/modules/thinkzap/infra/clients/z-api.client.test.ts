import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
