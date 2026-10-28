import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()

vi.mock('@/infra/client/axios-portal', () => ({
  axiosPortal: () => ({ get }),
}))

import {
  ADMIN_JOBS,
  deriveJobHealth,
  findAdminJob,
  jobHealthNeedsAttention,
  type JobRunSummary,
} from './admin-jobs'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-10-28T12:00:00Z')

const run = (overrides: Partial<JobRunSummary> = {}): JobRunSummary => ({
  id: 'run-1',
  status: 'success',
  abandoned: false,
  paused: false,
  itemFailures: 0,
  startedAt: '2026-10-28T11:48:00Z',
  ...overrides,
})

describe('deriveJobHealth', () => {
  it('sem rodadas', () => {
    expect(deriveJobHealth(null, HOUR, NOW)).toBe('no-runs')
  })

  it('em andamento e não abandonada', () => {
    expect(deriveJobHealth(run({ status: 'running' }), HOUR, NOW)).toBe(
      'running',
    )
  })

  it('failed é falha', () => {
    expect(deriveJobHealth(run({ status: 'failed' }), HOUR, NOW)).toBe(
      'failing',
    )
  })

  it('abandonada é falha', () => {
    expect(
      deriveJobHealth(
        run({
          status: 'running',
          abandoned: true,
          startedAt: '2026-10-28T10:30:00Z',
        }),
        HOUR,
        NOW,
      ),
    ).toBe('failing')
  })

  it('começou há mais que o dobro da periodicidade é atrasado', () => {
    expect(
      deriveJobHealth(run({ startedAt: '2026-10-28T09:00:00Z' }), HOUR, NOW),
    ).toBe('late')
  })

  it('atrasado vence atenção', () => {
    expect(
      deriveJobHealth(
        run({ startedAt: '2026-10-28T09:00:00Z', itemFailures: 2 }),
        HOUR,
        NOW,
      ),
    ).toBe('late')
  })

  it('success com falhas por item é atenção', () => {
    expect(deriveJobHealth(run({ itemFailures: 2 }), HOUR, NOW)).toBe(
      'attention',
    )
  })

  it('success pausada pelo Bitrix é atenção', () => {
    expect(deriveJobHealth(run({ paused: true }), HOUR, NOW)).toBe('attention')
  })

  it('success sem falhas é saudável', () => {
    expect(deriveJobHealth(run(), HOUR, NOW)).toBe('healthy')
  })
})

describe('jobHealthNeedsAttention', () => {
  it('só falha, atrasado e atenção', () => {
    expect(
      (
        [
          'no-runs',
          'running',
          'failing',
          'late',
          'attention',
          'healthy',
        ] as const
      ).filter(jobHealthNeedsAttention),
    ).toEqual(['failing', 'late', 'attention'])
  })
})

describe('registro de jobs', () => {
  beforeEach(() => get.mockReset())

  it('encontra a varredura de expiração pelo id e mais nada', () => {
    expect(findAdminJob('expiracao-assinaturas')?.intervalMs).toBe(HOUR)
    expect(findAdminJob('nao-existe')).toBeNull()
  })

  it('a varredura busca as rodadas mais recentes e adapta as falhas', async () => {
    get.mockResolvedValue({
      runs: [
        {
          id: 'r1',
          status: 'success',
          abandoned: false,
          paused: false,
          failed: 3,
          startedAt: '2026-10-28T11:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 24, totalPages: 1 },
    })

    const runs = await ADMIN_JOBS[0].fetchRecentRuns(24)

    expect(get).toHaveBeenCalledWith(
      '/portal/subscription-expiration/runs?page=1&limit=24',
    )
    expect(runs).toEqual([
      {
        id: 'r1',
        status: 'success',
        abandoned: false,
        paused: false,
        itemFailures: 3,
        startedAt: '2026-10-28T11:00:00Z',
      },
    ])
  })

  it('a sincronização Stripe está no catálogo, depois da verificação', async () => {
    expect(ADMIN_JOBS.map(job => job.id)).toEqual([
      'expiracao-assinaturas',
      'sincronizacao-stripe',
    ])
    get.mockResolvedValue({
      runs: [
        {
          id: 's1',
          status: 'success',
          abandoned: false,
          paused: false,
          failed: 1,
          startedAt: '2026-10-28T12:30:00Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 24, totalPages: 1 },
    })

    const runs = await findAdminJob('sincronizacao-stripe')!.fetchRecentRuns(24)

    expect(get).toHaveBeenCalledWith('/portal/stripe-sync/runs?page=1&limit=24')
    expect(runs[0]).toMatchObject({ id: 's1', itemFailures: 1 })
  })
})
