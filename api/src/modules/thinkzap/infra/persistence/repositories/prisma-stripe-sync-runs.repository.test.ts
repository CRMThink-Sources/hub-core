import { describe, expect, it, vi } from 'vitest'
import {
  PrismaStripeSyncRunRepository,
  StripeSyncRunPrismaClient,
} from './prisma-stripe-sync-runs.repository'

const runRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  trigger: 'SCHEDULED',
  status: 'SUCCESS',
  startedAt: new Date('2026-10-28T12:30:00Z'),
  finishedAt: new Date('2026-10-28T12:30:09Z'),
  checked: 14,
  skipped: 12,
  updated: 1,
  cancelled: 1,
  linesUnsubscribed: 2,
  notFound: 1,
  failed: 0,
  paused: false,
  error: null,
  triggeredBy: null,
  ...overrides,
})

type FindManyArgs = { where: { OR?: unknown[] } }

const makePrisma = () => {
  const run = {
    create: vi.fn().mockResolvedValue({ id: 'run-1' }),
    update: vi.fn().mockReturnValue('update-op'),
    findMany: vi.fn().mockResolvedValue([runRow()]),
    findUnique: vi.fn(),
    count: vi.fn().mockResolvedValue(1),
    deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
  }
  const change = { createMany: vi.fn().mockReturnValue('create-many-op') }
  const $transaction = vi.fn().mockResolvedValue([])

  const prisma = {
    stripeSyncRun: run,
    stripeSyncChange: change,
    $transaction,
  } as unknown as StripeSyncRunPrismaClient

  return {
    repo: new PrismaStripeSyncRunRepository(prisma),
    run,
    change,
    $transaction,
  }
}

describe('PrismaStripeSyncRunRepository', () => {
  it('start cria rodada com trigger e usuário', async () => {
    const { repo, run } = makePrisma()

    await expect(
      repo.start({ trigger: 'manual', portalUserId: 'user-1' }),
    ).resolves.toBe('run-1')
    expect(run.create).toHaveBeenCalledWith({
      data: { trigger: 'MANUAL', triggeredByPortalUserId: 'user-1' },
      select: { id: true },
    })
  })

  it('finish grava changes e contadores na mesma transação', async () => {
    const { repo, run, change, $transaction } = makePrisma()
    const finishedAt = new Date('2026-10-28T12:30:09Z')

    await repo.finish(
      'run-1',
      {
        checked: 14,
        skipped: 12,
        updated: 1,
        cancelled: 0,
        linesUnsubscribed: 0,
        notFound: 1,
        failed: 0,
        paused: false,
        changes: [
          {
            kind: 'updated',
            subscriptionId: '501',
            gatewayId: 'sub_1',
            fromStatus: 'active',
            toStatus: 'past_due',
            fromPeriodEnd: new Date('2026-10-28T23:59:59.999Z'),
            toPeriodEnd: new Date('2026-11-28T14:00:00Z'),
            succeeded: true,
          },
          {
            kind: 'not-found',
            subscriptionId: '502',
            gatewayId: 'sub_x',
            fromStatus: 'active',
            toStatus: null,
            fromPeriodEnd: null,
            toPeriodEnd: null,
            succeeded: false,
            error: 'Assinatura não encontrada no Stripe',
          },
        ],
      },
      finishedAt,
    )

    expect(change.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          runId: 'run-1',
          kind: 'updated',
          subscriptionId: '501',
          gatewayId: 'sub_1',
          itemId: null,
          provider: null,
          toStatus: 'past_due',
        }),
        expect.objectContaining({
          kind: 'not-found',
          gatewayId: 'sub_x',
          succeeded: false,
          error: 'Assinatura não encontrada no Stripe',
        }),
      ],
    })
    const counters: unknown = expect.objectContaining({
      status: 'SUCCESS',
      finishedAt,
      checked: 14,
      skipped: 12,
      updated: 1,
      notFound: 1,
    })
    expect(run.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: counters,
    })
    expect($transaction).toHaveBeenCalledWith(['create-many-op', 'update-op'])
  })

  it('list filtra "só com alterações" pelos contadores de alteração e falha', async () => {
    const { repo, run } = makePrisma()

    const result = await repo.list({
      page: 2,
      limit: 20,
      onlyWithChanges: true,
    })

    const args = run.findMany.mock.calls[0]?.[0] as FindManyArgs
    expect(args).toMatchObject({ skip: 20, take: 20 })
    expect(args.where.OR).toHaveLength(6)
    expect(result.runs[0]).toMatchObject({
      trigger: 'scheduled',
      status: 'success',
      notFound: 1,
      linesUnsubscribed: 2,
    })
  })

  it('findById mapeia as changes de linha', async () => {
    const { repo, run } = makePrisma()
    run.findUnique.mockResolvedValue({
      ...runRow(),
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
          error: null,
        },
      ],
    })

    const detail = await repo.findById('run-1')

    expect(detail?.changes).toEqual([
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
    ])
  })

  it('findById devolve null para id desconhecido', async () => {
    const { repo, run } = makePrisma()
    run.findUnique.mockResolvedValue(null)

    await expect(repo.findById('x')).resolves.toBeNull()
  })

  it('deleteStartedBefore apaga por startedAt', async () => {
    const { repo, run } = makePrisma()
    const date = new Date('2026-07-30T00:00:00Z')

    await expect(repo.deleteStartedBefore(date)).resolves.toBe(3)
    expect(run.deleteMany).toHaveBeenCalledWith({
      where: { startedAt: { lt: date } },
    })
  })
})
