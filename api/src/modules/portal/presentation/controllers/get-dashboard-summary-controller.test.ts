import { describe, expect, it, vi } from 'vitest'
import { GetDashboardSummaryController } from './get-dashboard-summary-controller'
import type { GetDashboardSummary } from '../../application/get-dashboard-summary'

describe('GetDashboardSummaryController', () => {
  it('devolve 200 com o resumo', async () => {
    const summary = {
      clients: 128,
      subscriptions: { active: 94, pastDue: 6, trialing: 12 },
      generatedAt: new Date('2026-10-28T12:00:00Z'),
    }
    const controller = new GetDashboardSummaryController({
      execute: vi.fn().mockResolvedValue(summary),
    } as unknown as GetDashboardSummary)

    const response = await controller.perform({} as never, {} as never)

    expect(response.status).toBe(200)
    expect(response.result).toEqual(summary)
  })
})
