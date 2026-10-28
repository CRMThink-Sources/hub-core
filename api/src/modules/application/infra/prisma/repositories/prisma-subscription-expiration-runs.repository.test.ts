import { describe, expect, it, vi } from 'vitest'
import {
  PrismaSubscriptionExpirationRunRepository,
  SubscriptionExpirationRunPrismaClient,
} from './prisma-subscription-expiration-runs.repository'

const runRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  trigger: 'MANUAL',
  status: 'SUCCESS',
  startedAt: new Date('2026-10-13T12:00:00Z'),
  finishedAt: new Date('2026-10-13T12:00:05Z'),
  checked: 3,
  trialExpired: 1,
  pastDue: 1,
  failed: 1,
  linesUnsubscribed: 0,
  cancelled: 0,
  linesChecked: 0,
  linesSubscribed: 0,
  reconciliation: false,
  providerStepsSkipped: false,
  paused: false,
  error: null,
  triggeredBy: { id: 'user-1', name: 'Ana' },
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
    deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
  }
  const change = { createMany: vi.fn().mockReturnValue('create-many-op') }
  const $transaction = vi.fn().mockResolvedValue([])

  const prisma = {
    subscriptionExpirationRun: run,
    subscriptionExpirationChange: change,
    $transaction,
  } as unknown as SubscriptionExpirationRunPrismaClient

  return {
    repo: new PrismaSubscriptionExpirationRunRepository(prisma),
    run,
    change,
    $transaction,
  }
}

describe('PrismaSubscriptionExpirationRunRepository', () => {
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
    const finishedAt = new Date('2026-10-13T12:00:05Z')
    const periodEnd = new Date('2026-10-12T23:59:59.999Z')

    await repo.finish(
      'run-1',
      {
        checked: 2,
        trialExpired: 0,
        pastDue: 1,
        failed: 1,
        linesUnsubscribed: 2,
        cancelled: 1,
        linesChecked: 40,
        linesSubscribed: 1,
        reconciliation: true,
        providerStepsSkipped: false,
        paused: false,
        changes: [
          {
            kind: 'status',
            subscriptionId: '501',
            from: 'active',
            to: 'past_due',
            periodEnd,
            succeeded: true,
          },
          {
            kind: 'status',
            subscriptionId: '502',
            from: 'active',
            to: 'past_due',
            periodEnd,
            succeeded: false,
            error: 'bitrix fora',
          },
          {
            kind: 'line-unsubscribed',
            subscriptionId: '503',
            itemId: '9001',
            provider: 'ZAPI',
            from: null,
            to: null,
            periodEnd,
            succeeded: true,
          },
        ],
      },
      finishedAt,
    )

    expect(change.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          runId: 'run-1',
          subscriptionId: '501',
          fromStatus: 'active',
          toStatus: 'past_due',
          succeeded: true,
          error: null,
        }),
        expect.objectContaining({
          subscriptionId: '502',
          succeeded: false,
          error: 'bitrix fora',
        }),
        expect.objectContaining({
          kind: 'line-unsubscribed',
          subscriptionId: '503',
          itemId: '9001',
          provider: 'ZAPI',
          fromStatus: null,
          toStatus: null,
        }),
      ],
    })
    const expectedCounters: unknown = expect.objectContaining({
      status: 'SUCCESS',
      finishedAt,
      pastDue: 1,
      failed: 1,
      linesUnsubscribed: 2,
      cancelled: 1,
      linesChecked: 40,
      linesSubscribed: 1,
      reconciliation: true,
      providerStepsSkipped: false,
    })
    expect(run.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expectedCounters,
    })
    expect($transaction).toHaveBeenCalledWith(['create-many-op', 'update-op'])
  })

  it('list pagina, filtra trigger e "só com alterações"', async () => {
    const { repo, run } = makePrisma()

    const result = await repo.list({
      page: 3,
      limit: 20,
      trigger: 'scheduled',
      onlyWithChanges: true,
    })

    const args = run.findMany.mock.calls[0]?.[0] as FindManyArgs
    expect(args).toMatchObject({
      skip: 40,
      take: 20,
      orderBy: { startedAt: 'desc' },
      where: { trigger: 'SCHEDULED' },
    })
    expect(args.where.OR).toHaveLength(7)
    expect(run.count).toHaveBeenCalledWith({ where: args.where })
    expect(result.total).toBe(1)
    expect(result.runs[0]).toMatchObject({
      trigger: 'manual',
      status: 'success',
      triggeredBy: { id: 'user-1', name: 'Ana' },
    })
  })

  it('list sem filtros não restringe', async () => {
    const { repo, run } = makePrisma()

    await repo.list({ page: 1, limit: 20 })

    const args = run.findMany.mock.calls[0]?.[0] as FindManyArgs
    expect(args.where).toEqual({})
  })

  it('findById devolve null para id desconhecido', async () => {
    const { repo, run } = makePrisma()
    run.findUnique.mockResolvedValue(null)

    await expect(repo.findById('x')).resolves.toBeNull()
  })

  it('findById mapeia as changes', async () => {
    const { repo, run } = makePrisma()
    run.findUnique.mockResolvedValue({
      ...runRow(),
      changes: [
        {
          kind: 'status',
          subscriptionId: '501',
          itemId: null,
          provider: null,
          fromStatus: 'trialing',
          toStatus: 'trial_expired',
          periodEnd: new Date('2026-10-12T23:59:59.999Z'),
          succeeded: true,
          error: null,
        },
        {
          kind: 'line-subscribed',
          subscriptionId: '777',
          itemId: '9003',
          provider: 'HUBMESSAGE',
          fromStatus: null,
          toStatus: null,
          periodEnd: null,
          succeeded: true,
          error: null,
        },
      ],
    })

    const detail = await repo.findById('run-1')

    expect(detail?.changes).toEqual([
      {
        kind: 'status',
        subscriptionId: '501',
        from: 'trialing',
        to: 'trial_expired',
        periodEnd: new Date('2026-10-12T23:59:59.999Z'),
        succeeded: true,
      },
      {
        kind: 'line-subscribed',
        subscriptionId: '777',
        itemId: '9003',
        provider: 'HUBMESSAGE',
        from: null,
        to: null,
        periodEnd: null,
        succeeded: true,
      },
    ])
  })

  it('hasReconciliationSince conta rodadas com reconciliação desde a data', async () => {
    const { repo, run } = makePrisma()
    const since = new Date('2026-10-28T03:00:00Z')
    run.count.mockResolvedValueOnce(0)

    await expect(repo.hasReconciliationSince(since)).resolves.toBe(false)
    expect(run.count).toHaveBeenCalledWith({
      where: { reconciliation: true, startedAt: { gte: since } },
    })
  })

  it('rodada antiga (antes da verificação) lê os contadores novos em zero', async () => {
    const { repo, run } = makePrisma()
    run.findMany.mockResolvedValue([runRow()])

    const { runs } = await repo.list({ page: 1, limit: 20 })

    expect(runs[0]).toMatchObject({
      linesUnsubscribed: 0,
      cancelled: 0,
      linesSubscribed: 0,
      reconciliation: false,
    })
  })

  it('deleteStartedBefore apaga por startedAt (changes em cascata no banco)', async () => {
    const { repo, run } = makePrisma()
    const cutoff = new Date('2026-07-15T12:00:00Z')

    await expect(repo.deleteStartedBefore(cutoff)).resolves.toBe(4)
    expect(run.deleteMany).toHaveBeenCalledWith({
      where: { startedAt: { lt: cutoff } },
    })
  })
})
