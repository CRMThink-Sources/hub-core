import { describe, expect, it, vi } from 'vitest'
import type { StripeSyncRun } from '@/modules/thinkzap/domain/entities/stripe-sync-run'
import {
  GetStripeSyncRun,
  ListStripeSyncRuns,
} from '../../application/stripe-sync-runs'
import {
  GetStripeSyncRunController,
  ListStripeSyncRunsController,
  StartStripeSyncRunController,
} from './stripe-sync-runs-controller'

const NOW = new Date('2026-10-28T13:00:00Z')

const run = (overrides: Partial<StripeSyncRun> = {}): StripeSyncRun => ({
  id: 'run-1',
  trigger: 'scheduled',
  triggeredBy: null,
  status: 'success',
  startedAt: new Date('2026-10-28T12:30:00Z'),
  finishedAt: new Date('2026-10-28T12:30:09Z'),
  checked: 14,
  skipped: 12,
  updated: 1,
  cancelled: 0,
  linesUnsubscribed: 0,
  notFound: 1,
  failed: 0,
  paused: false,
  error: null,
  ...overrides,
})

describe('ListStripeSyncRunsController', () => {
  it('lista com duração, paginação e repasse dos filtros', async () => {
    const list = vi.fn().mockResolvedValue({ runs: [run()], total: 1 })
    const controller = new ListStripeSyncRunsController(
      new ListStripeSyncRuns({ list }, () => NOW),
    )

    const response = await controller.perform(
      { query: { page: '1', onlyWithChanges: 'true' } } as never,
      {} as never,
    )

    expect(list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      onlyWithChanges: true,
    })
    expect(response.result).toMatchObject({
      runs: [{ id: 'run-1', durationMs: 9000, abandoned: false }],
      meta: { total: 1, totalPages: 1 },
    })
  })
})

describe('GetStripeSyncRunController', () => {
  it('404 para rodada desconhecida', async () => {
    const controller = new GetStripeSyncRunController(
      new GetStripeSyncRun(
        { findById: vi.fn().mockResolvedValue(null) },
        'https://crm.example.com',
        1142,
        1146,
      ),
    )

    const response = await controller.perform(
      { params: { id: 'x' } } as never,
      {} as never,
    )

    expect(response.status).toBe(404)
  })

  it('links da assinatura e do item no detalhe', async () => {
    const controller = new GetStripeSyncRunController(
      new GetStripeSyncRun(
        {
          findById: vi.fn().mockResolvedValue({
            ...run(),
            changes: [
              {
                kind: 'line-unsubscribed',
                subscriptionId: '503',
                gatewayId: 'sub_3',
                itemId: '9001',
                provider: 'ZAPI',
                fromStatus: null,
                toStatus: null,
                fromPeriodEnd: null,
                toPeriodEnd: null,
                succeeded: true,
              },
            ],
          }),
        },
        'https://crm.example.com',
        1142,
        1146,
        () => NOW,
      ),
    )

    const response = await controller.perform(
      { params: { id: 'run-1' } } as never,
      {} as never,
    )

    expect(response.result).toMatchObject({
      changes: [
        {
          crmUrl: 'https://crm.example.com/crm/type/1142/details/503/',
          itemCrmUrl: 'https://crm.example.com/crm/type/1146/details/9001/',
        },
      ],
    })
  })
})

describe('StartStripeSyncRunController', () => {
  it('202 com o id da rodada', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ status: 'started', runId: 'run-9' })
    const controller = new StartStripeSyncRunController({ execute })

    const response = await controller.perform(
      { portalUserId: 'user-1' } as never,
      {} as never,
    )

    expect(execute).toHaveBeenCalledWith('user-1')
    expect(response).toEqual({ status: 202, result: { runId: 'run-9' } })
  })

  it.each(['busy', 'disabled'] as const)('409 com code %s', async status => {
    const controller = new StartStripeSyncRunController({
      execute: vi.fn().mockResolvedValue({ status }),
    })

    const response = await controller.perform(
      { portalUserId: 'user-1' } as never,
      {} as never,
    )

    expect(response.status).toBe(409)
    expect(response.result).toMatchObject({ code: status })
  })
})
