import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get, post }),
}))

import {
  listExpirationRuns,
  startExpirationRun,
} from './subscription-expiration-runs'

const conflict = (result: unknown) =>
  new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    data: { result },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('listExpirationRuns', () => {
  it('manda paginação e só os filtros ligados', async () => {
    get.mockResolvedValue({ runs: [], meta: {} })

    await listExpirationRuns({ page: 2, limit: 20 })
    await listExpirationRuns({
      page: 1,
      limit: 20,
      trigger: 'manual',
      onlyWithChanges: true,
    })

    expect(get.mock.calls[0]?.[0]).toBe(
      '/portal/subscription-expiration/runs?page=2&limit=20',
    )
    expect(get.mock.calls[1]?.[0]).toBe(
      '/portal/subscription-expiration/runs?page=1&limit=20&trigger=manual&onlyWithChanges=true',
    )
  })
})

describe('startExpirationRun', () => {
  it('devolve o id da rodada iniciada', async () => {
    post.mockResolvedValue({ runId: 'run-1' })

    await expect(startExpirationRun()).resolves.toEqual({
      status: 'started',
      runId: 'run-1',
    })
  })

  it.each(['busy', 'disabled'] as const)(
    'converte o 409 %s em resultado',
    async code => {
      post.mockRejectedValue(conflict({ code, error: 'x' }))

      await expect(startExpirationRun()).resolves.toEqual({ status: code })
    },
  )

  it('outros erros sobem', async () => {
    post.mockRejectedValue(conflict({ error: 'sem code' }))
    await expect(startExpirationRun()).rejects.toBeInstanceOf(AxiosError)

    post.mockRejectedValue(new Error('rede'))
    await expect(startExpirationRun()).rejects.toThrow('rede')
  })
})
