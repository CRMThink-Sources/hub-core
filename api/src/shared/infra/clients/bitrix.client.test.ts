import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixClient } from './bitrix.client'

const mockAxiosDefaults = { adapter: 'fetch' as const }

const { axiosCreate, getBitrixAxiosDefaults } = vi.hoisted(() => ({
  axiosCreate: vi.fn(() => ({ post: vi.fn(), get: vi.fn() })),
  getBitrixAxiosDefaults: vi.fn(() => mockAxiosDefaults),
}))

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isAxiosError: vi.fn(),
  },
}))

vi.mock('./bitrix-axios-config', () => ({
  getBitrixAxiosDefaults,
}))

describe('BitrixClient.withUserToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBitrixAxiosDefaults.mockReturnValue(mockAxiosDefaults)
  })

  it('creates axios client with baseURL, user access token and Bitrix TLS defaults', () => {
    const client = BitrixClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'operator-token-123',
    )

    client.getClient()

    expect(getBitrixAxiosDefaults).toHaveBeenCalled()
    expect(axiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://crmthink.bitrix24.com.br/rest/',
      params: { auth: 'operator-token-123' },
      adapter: 'fetch',
    })
  })

  it('does not require persisted credential', () => {
    const client = BitrixClient.withUserToken('example.bitrix24.com', 'token')

    expect(() => client.getClient()).not.toThrow()
  })
})
