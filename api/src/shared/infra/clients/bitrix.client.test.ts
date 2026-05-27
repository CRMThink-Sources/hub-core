import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixClient } from './bitrix.client'

const { axiosCreate } = vi.hoisted(() => ({
  axiosCreate: vi.fn(() => ({ post: vi.fn(), get: vi.fn() })),
}))

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isAxiosError: vi.fn(),
  },
}))

describe('BitrixClient.withUserToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates axios client with baseURL and user access token', () => {
    const client = BitrixClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'operator-token-123',
    )

    client.getClient()

    expect(axiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://crmthink.bitrix24.com.br/rest/',
      params: { auth: 'operator-token-123' },
    })
  })

  it('does not require persisted credential', () => {
    const client = BitrixClient.withUserToken('example.bitrix24.com', 'token')

    expect(() => client.getClient()).not.toThrow()
  })
})
