import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get }),
}))

import { getDashboardSummary } from './portal-dashboard'

beforeEach(() => get.mockReset())

describe('getDashboardSummary', () => {
  it('lê o resumo do painel', async () => {
    const summary = {
      clients: 128,
      subscriptions: { active: 94, pastDue: 6, trialing: 12 },
      generatedAt: '2026-10-28T12:00:00.000Z',
    }
    get.mockResolvedValue(summary)

    await expect(getDashboardSummary()).resolves.toEqual(summary)
    expect(get).toHaveBeenCalledWith('/portal/dashboard/summary')
  })

  it('propaga a assinatura indisponível como null', async () => {
    get.mockResolvedValue({
      clients: 128,
      subscriptions: null,
      generatedAt: '2026-10-28T12:00:00.000Z',
    })

    await expect(getDashboardSummary()).resolves.toMatchObject({
      subscriptions: null,
    })
  })
})
