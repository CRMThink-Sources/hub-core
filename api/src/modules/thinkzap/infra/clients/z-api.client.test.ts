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
