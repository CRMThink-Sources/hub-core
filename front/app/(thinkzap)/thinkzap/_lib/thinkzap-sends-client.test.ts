import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import type { ThinkzapHttpClient } from '@/infra/client/axios-thinkzap'
import { getSendDetail, listSends } from './thinkzap-sends-client'

function httpError(status: number) {
  return new AxiosError('falhou', 'ERR', undefined, undefined, {
    status,
  } as never)
}

function clientWith(get: ThinkzapHttpClient['get']) {
  return { get } as unknown as ThinkzapHttpClient
}

describe('getSendDetail', () => {
  it('devolve o detalhe encontrado e escapa o id', async () => {
    const get = vi.fn().mockResolvedValue({ id: 'a/b' })
    const result = await getSendDetail(clientWith(get), 'a/b')
    expect(result).toEqual({ kind: 'found', detail: { id: 'a/b' } })
    expect(get).toHaveBeenCalledWith('/thinkzap/messages/sends/a%2Fb')
  })

  it('404 vira not-found', async () => {
    const get = vi.fn().mockRejectedValue(httpError(404))
    expect(await getSendDetail(clientWith(get), 'x')).toEqual({
      kind: 'not-found',
    })
  })

  it('outros erros propagam', async () => {
    const get = vi.fn().mockRejectedValue(httpError(500))
    await expect(getSendDetail(clientWith(get), 'x')).rejects.toBeInstanceOf(
      AxiosError,
    )
  })
})

describe('listSends', () => {
  it('chama a rota com a query', async () => {
    const get = vi.fn().mockResolvedValue({ items: [] })
    await listSends(clientWith(get), { from: 'a', to: 'b', page: 2 })
    expect(get).toHaveBeenCalledWith('/thinkzap/messages/sends', {
      params: { from: 'a', to: 'b', page: 2 },
    })
  })
})
