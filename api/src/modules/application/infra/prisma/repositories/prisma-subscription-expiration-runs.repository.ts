import { PrismaClient } from '@/prisma/client'
import {
  SubscriptionExpirationChange,
  SubscriptionExpirationResult,
  SubscriptionExpirationRun,
  SubscriptionExpirationRunDetail,
  SubscriptionExpirationRunStatus,
  SubscriptionExpirationTrigger,
} from '@/modules/application/domain/entities/subscription-expiration-run'
import {
  ListSubscriptionExpirationRunsInput,
  SubscriptionExpirationRunRepository,
} from '@/modules/application/domain/repositories/subscription-expiration-run.repository'

export type SubscriptionExpirationRunPrismaClient = Pick<
  PrismaClient,
  'subscriptionExpirationRun' | 'subscriptionExpirationChange' | '$transaction'
>

type DbTrigger = 'SCHEDULED' | 'MANUAL'
type DbStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

const TRIGGER_TO_DB: Record<SubscriptionExpirationTrigger, DbTrigger> = {
  scheduled: 'SCHEDULED',
  manual: 'MANUAL',
}

const TRIGGER_FROM_DB: Record<DbTrigger, SubscriptionExpirationTrigger> = {
  SCHEDULED: 'scheduled',
  MANUAL: 'manual',
}

const STATUS_FROM_DB: Record<DbStatus, SubscriptionExpirationRunStatus> = {
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
  trialExpired: number
  pastDue: number
  failed: number
  paused: boolean
  error: string | null
  triggeredBy: { id: string; name: string } | null
}

type ChangeRow = {
  subscriptionId: string
  fromStatus: string
  toStatus: string
  periodEnd: Date
  succeeded: boolean
  error: string | null
}

const toRun = (row: RunRow): SubscriptionExpirationRun => ({
  id: row.id,
  trigger: TRIGGER_FROM_DB[row.trigger],
  triggeredBy: row.triggeredBy
    ? { id: row.triggeredBy.id, name: row.triggeredBy.name }
    : null,
  status: STATUS_FROM_DB[row.status],
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  checked: row.checked,
  trialExpired: row.trialExpired,
  pastDue: row.pastDue,
  failed: row.failed,
  paused: row.paused,
  error: row.error,
})

/**
 * Os status saem como gravaram: texto do domínio. O cast é a fronteira — quem
 * grava é só `finish`, a partir de valores já tipados.
 */
const toChange = (row: ChangeRow): SubscriptionExpirationChange => ({
  subscriptionId: row.subscriptionId,
  from: row.fromStatus as SubscriptionExpirationChange['from'],
  to: row.toStatus as SubscriptionExpirationChange['to'],
  periodEnd: row.periodEnd,
  succeeded: row.succeeded,
  ...(row.error ? { error: row.error } : {}),
})

const TRIGGERED_BY_SELECT = {
  triggeredBy: { select: { id: true, name: true } },
} as const

export class PrismaSubscriptionExpirationRunRepository implements SubscriptionExpirationRunRepository {
  constructor(private readonly prisma: SubscriptionExpirationRunPrismaClient) {}

  async start(input: {
    trigger: SubscriptionExpirationTrigger
    portalUserId?: string
  }): Promise<string> {
    const run = await this.prisma.subscriptionExpirationRun.create({
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
    result: SubscriptionExpirationResult,
    finishedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.subscriptionExpirationChange.createMany({
        data: result.changes.map(change => ({
          runId: id,
          subscriptionId: change.subscriptionId,
          fromStatus: change.from,
          toStatus: change.to,
          periodEnd: change.periodEnd,
          succeeded: change.succeeded,
          error: change.error ?? null,
        })),
      }),
      this.prisma.subscriptionExpirationRun.update({
        where: { id },
        data: {
          status: 'SUCCESS',
          finishedAt,
          checked: result.checked,
          trialExpired: result.trialExpired,
          pastDue: result.pastDue,
          failed: result.failed,
          paused: result.paused,
        },
      }),
    ])
  }

  async fail(id: string, error: string, finishedAt: Date): Promise<void> {
    await this.prisma.subscriptionExpirationRun.update({
      where: { id },
      data: { status: 'FAILED', finishedAt, error },
    })
  }

  async list(
    input: ListSubscriptionExpirationRunsInput,
  ): Promise<{ runs: SubscriptionExpirationRun[]; total: number }> {
    const where = {
      ...(input.trigger && { trigger: TRIGGER_TO_DB[input.trigger] }),
      ...(input.onlyWithChanges && {
        OR: [
          { trialExpired: { gt: 0 } },
          { pastDue: { gt: 0 } },
          { failed: { gt: 0 } },
          { status: { not: 'SUCCESS' as const } },
        ],
      }),
    }

    const [rows, total] = await Promise.all([
      this.prisma.subscriptionExpirationRun.findMany({
        where,
        include: TRIGGERED_BY_SELECT,
        orderBy: { startedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.subscriptionExpirationRun.count({ where }),
    ])

    return { runs: rows.map(toRun), total }
  }

  async findById(id: string): Promise<SubscriptionExpirationRunDetail | null> {
    const row = await this.prisma.subscriptionExpirationRun.findUnique({
      where: { id },
      include: {
        ...TRIGGERED_BY_SELECT,
        changes: { orderBy: { subscriptionId: 'asc' } },
      },
    })
    if (!row) return null

    return { ...toRun(row), changes: row.changes.map(toChange) }
  }

  async deleteStartedBefore(date: Date): Promise<number> {
    const { count } = await this.prisma.subscriptionExpirationRun.deleteMany({
      where: { startedAt: { lt: date } },
    })

    return count
  }
}
