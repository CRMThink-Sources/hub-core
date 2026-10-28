import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get, post }),
}))

import { listStripeSyncRuns, startStripeSyncRun } from './stripe-sync-runs'

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

describe('listStripeSyncRuns', () => {
  it('monta a query com os filtros', async () => {
    get.mockResolvedValue({ runs: [], meta: {} })

    await listStripeSyncRuns({
      page: 2,
      limit: 20,
      trigger: 'manual',
      onlyWithChanges: true,
    })

    expect(get).toHaveBeenCalledWith(
      '/portal/stripe-sync/runs?page=2&limit=20&trigger=manual&onlyWithChanges=true',
    )
  })
})

describe('startStripeSyncRun', () => {
  it('devolve o id da rodada', async () => {
    post.mockResolvedValue({ runId: 'run-1' })

    await expect(startStripeSyncRun()).resolves.toEqual({
      status: 'started',
      runId: 'run-1',
    })
  })

  it.each(['busy', 'disabled'] as const)(
    '409 %s vira resultado',
    async code => {
      post.mockRejectedValue(conflict({ code }))

      await expect(startStripeSyncRun()).resolves.toEqual({ status: code })
    },
  )
})
