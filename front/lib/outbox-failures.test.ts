import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get, post }),
}))

import {
  listOutboxFailures,
  reprocessOutboxFailure,
  reprocessOutboxFailures,
  summarizeReprocess,
} from './outbox-failures'

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

describe('listOutboxFailures', () => {
  it('manda paginação e só os filtros preenchidos', async () => {
    get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await listOutboxFailures({ page: 1, limit: 20 })
    await listOutboxFailures({
      page: 2,
      limit: 20,
      status: 'FAILED',
      domain: 'querobombinhas',
      origin: 'OPERATOR',
      from: '2026-10-27T03:00:00.000Z',
      to: '2026-10-28T02:59:59.999Z',
    })

    expect(get.mock.calls[0][0]).toBe(
      '/portal/thinkzap/outbox-failures?page=1&limit=20',
    )
    const url = new URL(`http://x${get.mock.calls[1][0] as string}`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      limit: '20',
      status: 'FAILED',
      domain: 'querobombinhas',
      origin: 'OPERATOR',
      from: '2026-10-27T03:00:00.000Z',
      to: '2026-10-28T02:59:59.999Z',
    })
  })
})

describe('reprocessOutboxFailure', () => {
  it('aceito vira requeued e repassa o aceite de duplicidade', async () => {
    post.mockResolvedValue({ id: 'a', status: 'requeued' })

    await expect(reprocessOutboxFailure('a', true)).resolves.toBe('requeued')
    expect(post).toHaveBeenCalledWith(
      '/portal/thinkzap/outbox-failures/a/reprocess',
      { acknowledgeDuplicateRisk: true },
    )
  })

  it.each([
    [409, 'conflict'],
    [422, 'needs-confirmation'],
    [404, 'not-found'],
    [503, 'schedule-failed'],
  ])('recusa %i vira o código %s, não exceção', async (status, code) => {
    post.mockRejectedValue(refusal(status, code))

    await expect(reprocessOutboxFailure('a')).resolves.toBe(code)
  })

  it('erro sem código conhecido continua sendo exceção', async () => {
    post.mockRejectedValue(new Error('rede'))

    await expect(reprocessOutboxFailure('a')).rejects.toThrow('rede')
  })
})

describe('reprocessOutboxFailures', () => {
  it('devolve o resultado por id do lote', async () => {
    post.mockResolvedValue({
      results: [
        { id: 'a', status: 'requeued' },
        { id: 'b', status: 'conflict' },
      ],
    })

    const results = await reprocessOutboxFailures(['a', 'b'])

    expect(post).toHaveBeenCalledWith(
      '/portal/thinkzap/outbox-failures/reprocess',
      { ids: ['a', 'b'], acknowledgeDuplicateRisk: false },
    )
    expect(summarizeReprocess(results)).toMatchObject({
      requeued: 1,
      conflict: 1,
    })
  })
})

describe('traduções de "Falhas de envio"', () => {
  const keysOf = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) =>
          keysOf(child, prefix ? `${prefix}.${key}` : key),
        )
      : [prefix]

  const load = (locale: string, namespace: string) =>
    JSON.parse(
      readFileSync(
        path.join(__dirname, '..', 'messages', locale, `${namespace}.json`),
        'utf8',
      ),
    ) as unknown

  it.each(['admin/outbox-failures', 'admin/home'])(
    '%s tem as mesmas chaves em pt, en e es',
    namespace => {
      const pt = keysOf(load('pt', namespace)).sort()

      expect(keysOf(load('en', namespace)).sort()).toEqual(pt)
      expect(keysOf(load('es', namespace)).sort()).toEqual(pt)
    },
  )
})
