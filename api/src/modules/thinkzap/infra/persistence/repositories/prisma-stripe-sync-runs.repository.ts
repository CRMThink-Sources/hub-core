import { PrismaClient } from '@/prisma/client'
import type {
  StripeSyncChange,
  StripeSyncResult,
  StripeSyncRun,
  StripeSyncRunDetail,
  StripeSyncRunStatus,
  StripeSyncTrigger,
} from '@/modules/thinkzap/domain/entities/stripe-sync-run'
import type {
  ListStripeSyncRunsInput,
  StripeSyncRunRepository,
} from '@/modules/thinkzap/domain/repositories/stripe-sync-run.repository'

export type StripeSyncRunPrismaClient = Pick<
  PrismaClient,
  'stripeSyncRun' | 'stripeSyncChange' | '$transaction'
>

type DbTrigger = 'SCHEDULED' | 'MANUAL'
type DbStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

const TRIGGER_TO_DB: Record<StripeSyncTrigger, DbTrigger> = {
  scheduled: 'SCHEDULED',
  manual: 'MANUAL',
}

const TRIGGER_FROM_DB: Record<DbTrigger, StripeSyncTrigger> = {
  SCHEDULED: 'scheduled',
  MANUAL: 'manual',
}

const STATUS_FROM_DB: Record<DbStatus, StripeSyncRunStatus> = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
}

type RunRow = {
  id: string
  trigger: DbTrigger
  status: DbStatus
  startedAt: Date
  finishedAt: Date | null
  checked: number
  skipped: number
  updated: number
  cancelled: number
  linesUnsubscribed: number
  notFound: number
  failed: number
  paused: boolean
  error: string | null
  triggeredBy: { id: string; name: string } | null
}

type ChangeRow = {
  kind: string
  subscriptionId: string
  gatewayId: string
  itemId: string | null
  provider: string | null
  fromStatus: string | null
  toStatus: string | null
  fromPeriodEnd: Date | null
  toPeriodEnd: Date | null
  succeeded: boolean
  error: string | null
}

const toRun = (row: RunRow): StripeSyncRun => ({
  id: row.id,
  trigger: TRIGGER_FROM_DB[row.trigger],
  triggeredBy: row.triggeredBy
    ? { id: row.triggeredBy.id, name: row.triggeredBy.name }
    : null,
  status: STATUS_FROM_DB[row.status],
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  checked: row.checked,
  skipped: row.skipped,
  updated: row.updated,
  cancelled: row.cancelled,
  linesUnsubscribed: row.linesUnsubscribed,
  notFound: row.notFound,
  failed: row.failed,
  paused: row.paused,
  error: row.error,
})

const toChange = (row: ChangeRow): StripeSyncChange => ({
  kind: row.kind as StripeSyncChange['kind'],
  subscriptionId: row.subscriptionId,
  gatewayId: row.gatewayId,
  ...(row.itemId ? { itemId: row.itemId } : {}),
  ...(row.provider
    ? { provider: row.provider as NonNullable<StripeSyncChange['provider']> }
    : {}),
  fromStatus: row.fromStatus as StripeSyncChange['fromStatus'],
  toStatus: row.toStatus,
  fromPeriodEnd: row.fromPeriodEnd,
  toPeriodEnd: row.toPeriodEnd,
  succeeded: row.succeeded,
  ...(row.error ? { error: row.error } : {}),
})

const TRIGGERED_BY_SELECT = {
  triggeredBy: { select: { id: true, name: true } },
} as const

export class PrismaStripeSyncRunRepository implements StripeSyncRunRepository {
  constructor(private readonly prisma: StripeSyncRunPrismaClient) {}

  async start(input: {
    trigger: StripeSyncTrigger
    portalUserId?: string
  }): Promise<string> {
    const run = await this.prisma.stripeSyncRun.create({
      data: {
        trigger: TRIGGER_TO_DB[input.trigger],
        triggeredByPortalUserId: input.portalUserId ?? null,
      },
      select: { id: true },
    })

    return run.id
  }

  async finish(
    id: string,
    result: StripeSyncResult,
    finishedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.stripeSyncChange.createMany({
        data: result.changes.map(change => ({
          runId: id,
          kind: change.kind,
          subscriptionId: change.subscriptionId,
          gatewayId: change.gatewayId,
          itemId: change.itemId ?? null,
          provider: change.provider ?? null,
          fromStatus: change.fromStatus,
          toStatus: change.toStatus,
          fromPeriodEnd: change.fromPeriodEnd,
          toPeriodEnd: change.toPeriodEnd,
          succeeded: change.succeeded,
          error: change.error ?? null,
        })),
      }),
      this.prisma.stripeSyncRun.update({
        where: { id },
        data: {
          status: 'SUCCESS',
          finishedAt,
          checked: result.checked,
          skipped: result.skipped,
          updated: result.updated,
          cancelled: result.cancelled,
          linesUnsubscribed: result.linesUnsubscribed,
          notFound: result.notFound,
          failed: result.failed,
          paused: result.paused,
        },
      }),
    ])
  }

  async fail(id: string, error: string, finishedAt: Date): Promise<void> {
    await this.prisma.stripeSyncRun.update({
      where: { id },
      data: { status: 'FAILED', finishedAt, error },
    })
  }

  async list(
    input: ListStripeSyncRunsInput,
  ): Promise<{ runs: StripeSyncRun[]; total: number }> {
    const where = {
      ...(input.trigger && { trigger: TRIGGER_TO_DB[input.trigger] }),
      ...(input.onlyWithChanges && {
        OR: [
          { updated: { gt: 0 } },
          { cancelled: { gt: 0 } },
          { linesUnsubscribed: { gt: 0 } },
          { notFound: { gt: 0 } },
          { failed: { gt: 0 } },
          { status: { not: 'SUCCESS' as const } },
        ],
      }),
    }

    const [rows, total] = await Promise.all([
      this.prisma.stripeSyncRun.findMany({
        where,
        include: TRIGGERED_BY_SELECT,
        orderBy: { startedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.stripeSyncRun.count({ where }),
    ])

    return { runs: rows.map(toRun), total }
  }

  async findById(id: string): Promise<StripeSyncRunDetail | null> {
    const row = await this.prisma.stripeSyncRun.findUnique({
      where: { id },
      include: {
        ...TRIGGERED_BY_SELECT,
        changes: { orderBy: [{ kind: 'asc' }, { subscriptionId: 'asc' }] },
      },
    })
    if (!row) return null

    return { ...toRun(row), changes: row.changes.map(toChange) }
  }

  async deleteStartedBefore(date: Date): Promise<number> {
    const { count } = await this.prisma.stripeSyncRun.deleteMany({
      where: { startedAt: { lt: date } },
    })

    return count
  }
}
