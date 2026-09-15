import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixClient } from './bitrix.client'

const mockAdapter = vi.fn()

vi.mock('./bitrix-axios-config', () => ({
  getBitrixAxiosDefaults: () => ({ adapter: mockAdapter }),
}))

const { axiosCreate, httpGet, httpPost } = vi.hoisted(() => {
  const httpGet = vi.fn()
  const httpPost = vi.fn()
  return {
    axiosCreate: vi.fn(() => ({ post: httpPost, get: httpGet })),
    httpGet,
    httpPost,
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isAxiosError: vi.fn(),
  },
}))

describe('BitrixClient.withUserToken', () => {
  it('creates axios client with native-fetch adapter', () => {
    const client = BitrixClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'operator-token-123',
    )

    client.getClient()

    expect(axiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://crmthink.bitrix24.com.br/rest/',
      params: { auth: 'operator-token-123' },
      adapter: mockAdapter,
    })
  })

  it('does not require persisted credential', () => {
    const client = BitrixClient.withUserToken('example.bitrix24.com', 'token')

    expect(() => client.getClient()).not.toThrow()
  })
})

describe('BitrixClient.getCompanyContactIds', () => {
  beforeEach(() => {
    httpGet.mockReset()
  })

  /**
   * Regressão: a versão anterior chamava `crm.company.contact.list`, que não
   * existe no REST do Bitrix — os contatos da empresa sumiam de toda lista de
   * destinos. A fonte correta é o `contactIds` do item da empresa.
   */
  it('reads contactIds from crm.item.get on the company entityTypeId', async () => {
    httpGet.mockResolvedValueOnce({
      data: { result: { item: { id: 5, contactIds: [10, '20', 10] } } },
    })

    const client = BitrixClient.withUserToken('example.bitrix24.com', 'token')

    await expect(client.getCompanyContactIds('5')).resolves.toEqual([
      '10',
      '20',
    ])
    expect(httpGet).toHaveBeenCalledWith('/crm.item.get', {
      params: { entityTypeId: 4, id: '5' },
    })
  })

  it('returns an empty list when the company has no linked contacts', async () => {
    httpGet.mockResolvedValueOnce({
      data: { result: { item: { id: 5 } } },
    })

    const client = BitrixClient.withUserToken('example.bitrix24.com', 'token')

    await expect(client.getCompanyContactIds('5')).resolves.toEqual([])
  })
})
