import { describe, expect, it, vi } from 'vitest'
import { GetDashboardSummary } from './get-dashboard-summary'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const COUNTED_AT = new Date('2026-10-28T11:59:30Z')
const NOW = new Date('2026-10-28T12:00:00Z')

describe('GetDashboardSummary', () => {
  it('junta clientes e assinaturas por status, com o instante da contagem', async () => {
    const summary = new GetDashboardSummary(
      { countAll: vi.fn().mockResolvedValue(128) },
      {
        count: vi.fn().mockResolvedValue({
          active: 94,
          pastDue: 6,
          trialing: 12,
          countedAt: COUNTED_AT,
        }),
      },
      () => NOW,
    )

    await expect(summary.execute()).resolves.toEqual({
      clients: 128,
      subscriptions: { active: 94, pastDue: 6, trialing: 12 },
      generatedAt: COUNTED_AT,
    })
  })

  it('Bitrix fora do ar: clientes preenchido e assinaturas null', async () => {
    const summary = new GetDashboardSummary(
      { countAll: vi.fn().mockResolvedValue(128) },
      { count: vi.fn().mockRejectedValue(new Error('bitrix down')) },
      () => NOW,
    )

    await expect(summary.execute()).resolves.toEqual({
      clients: 128,
      subscriptions: null,
      generatedAt: NOW,
    })
  })

  it('falha do banco não é engolida', async () => {
    const summary = new GetDashboardSummary(
      { countAll: vi.fn().mockRejectedValue(new Error('db down')) },
      {
        count: vi.fn().mockResolvedValue({
          active: 0,
          pastDue: 0,
          trialing: 0,
          countedAt: COUNTED_AT,
        }),
      },
    )

    await expect(summary.execute()).rejects.toThrow('db down')
  })
})
