import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get, post }),
}))

import {
  getInboundFailure,
  listInboundFailures,
  reprocessInboundFailure,
} from './inbound-failures'

const refusal = (status: number, code: string) =>
  new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Refused',
    data: { result: { error: 'x', code } },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('listInboundFailures', () => {
  it('manda paginação e só os filtros preenchidos', async () => {
    get.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      retentionDays: 7,
    })

    await listInboundFailures({ page: 1, limit: 20 })
    await listInboundFailures({
      page: 2,
      limit: 20,
      status: 'FAILED',
      domain: 'acme',
      domainId: 'domain-1',
      source: 'hubmessage',
      from: '2026-11-10T03:00:00.000Z',
      to: '2026-11-11T02:59:59.999Z',
    })

    expect(get.mock.calls[0][0]).toBe(
      '/portal/thinkzap/inbound-failures?page=1&limit=20',
    )
    const url = new URL(`http://x${get.mock.calls[1][0] as string}`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      limit: '20',
      status: 'FAILED',
      domain: 'acme',
      domainId: 'domain-1',
      source: 'hubmessage',
      from: '2026-11-10T03:00:00.000Z',
      to: '2026-11-11T02:59:59.999Z',
    })
  })
})

describe('getInboundFailure', () => {
  it('escapa o id no endereço', async () => {
    get.mockResolvedValue({ id: 'a/b' })

    await getInboundFailure('a/b')

    expect(get).toHaveBeenCalledWith('/portal/thinkzap/inbound-failures/a%2Fb')
  })
})

describe('reprocessInboundFailure', () => {
  it('aceito vira requeued', async () => {
    post.mockResolvedValue({ id: 'a', status: 'requeued' })

    await expect(reprocessInboundFailure('a')).resolves.toBe('requeued')
    expect(post).toHaveBeenCalledWith(
      '/portal/thinkzap/inbound-failures/a/reprocess',
      {},
    )
  })

  it.each([
    [409, 'conflict'],
    [422, 'not-reprocessable'],
    [404, 'not-found'],
    [503, 'schedule-failed'],
  ])('recusa %i vira o código %s, não exceção', async (status, code) => {
    post.mockRejectedValue(refusal(status, code))

    await expect(reprocessInboundFailure('a')).resolves.toBe(code)
  })

  it('erro sem código conhecido continua sendo exceção', async () => {
    post.mockRejectedValue(new Error('rede'))

    await expect(reprocessInboundFailure('a')).rejects.toThrow('rede')
  })
})
