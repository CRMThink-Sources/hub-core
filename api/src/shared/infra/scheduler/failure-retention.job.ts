import cron from 'node-cron'
import { env } from '@/config/env'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import { PrismaDeliveryAttemptRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-delivery-attempt.repository'
import { PrismaInboundFailureRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-inbound-failure.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import { redisFailureRetentionLock } from './failure-retention.lock'

/** Todo dia às 04:15: fora do :00 e do :30 dos jobs que falam com o Bitrix. */
const SCHEDULE = '15 4 * * *'

const DAY_MS = 24 * 60 * 60 * 1000

/** Linhas por lote: nenhuma operação segura a tabela por muito tempo. */
export const FAILURE_RETENTION_BATCH_SIZE = 500
/**
 * Teto de lotes por tabela numa rodada: um acúmulo enorme (ex.: instabilidade em massa)
 * não vira uma rodada de horas. O que sobrar é apagado na rodada seguinte.
 */
export const FAILURE_RETENTION_MAX_BATCHES = 200

/** Uma tabela com expurgo em lote. */
export type RetentionTarget = {
  /** Nome no log, para dizer quantas linhas saíram de cada tabela. */
  name: string
  deleteExpiredBatch(cutoff: Date, limit: number): Promise<number>
}

export type FailureRetentionJobDeps = {
  enabled: boolean
  retentionDays: number
  schedule: (expression: string, task: () => Promise<void>) => void
  lock: SubscriptionExpirationLock
  targets: RetentionTarget[]
  clock: () => Date
  batchSize: number
  maxBatches: number
}

const defaultDeps = (): FailureRetentionJobDeps => {
  const attempts = new PrismaDeliveryAttemptRepository()
  const inboundFailures = new PrismaInboundFailureRepository()
  const outbox = new PrismaWidgetOutboxRepository()

  return {
    enabled: env.failureRetention.purgeEnabled,
    retentionDays: env.failureRetention.days,
    schedule: (expression, task) => {
      cron.schedule(expression, task)
    },
    lock: redisFailureRetentionLock,
    // Tentativas primeiro: dependem das falhas só por `refId`, sem chave estrangeira.
    targets: [
      {
        name: 'tentativas',
        deleteExpiredBatch: (cutoff, limit) =>
          attempts.deleteExpiredBatch(cutoff, limit),
      },
      {
        name: 'falhas de recebimento',
        deleteExpiredBatch: (cutoff, limit) =>
          inboundFailures.deleteExpiredBatch(cutoff, limit),
      },
      {
        name: 'envios com falha',
        deleteExpiredBatch: (cutoff, limit) =>
          outbox.deleteExpiredFailuresBatch(cutoff, limit),
      },
    ],
    clock: () => new Date(),
    batchSize: FAILURE_RETENTION_BATCH_SIZE,
    maxBatches: FAILURE_RETENTION_MAX_BATCHES,
  }
}

/**
 * Agenda o expurgo diário das falhas de mensagens (`retencao-falhas`). Desligado, nem
 * agenda: apaga dado, e um ambiente local apontando para um banco compartilhado não deve
 * fazê-lo. Quando staging e produção dividem o banco, ligue em um só (ver `DEPLOY.md`).
 */
export function startFailureRetentionJob(
  overrides: Partial<FailureRetentionJobDeps> = {},
): void {
  const deps = { ...defaultDeps(), ...overrides }

  if (!deps.enabled) {
    apiLogger.info(
      { app: 'thinkzap' },
      '[FailureRetentionJob] Desligado (FAILURE_PURGE_ENABLED não é "true")',
    )
    return
  }

  deps.schedule(SCHEDULE, () => runFailureRetention(deps))

  apiLogger.info(
    {
      app: 'thinkzap',
      schedule: SCHEDULE,
      retentionDays: deps.retentionDays,
    },
    '[FailureRetentionJob] Agendado',
  )
}

/** Uma rodada. Nunca lança: erro vai para o log e a próxima rodada continua de onde parou. */
export async function runFailureRetention(
  deps: FailureRetentionJobDeps,
): Promise<void> {
  let token: string | null = null

  try {
    token = await deps.lock.tryAcquire()
    if (!token) {
      apiLogger.info(
        { app: 'thinkzap' },
        '[FailureRetentionJob] Rodada pulada (outro processo tem o lock)',
      )
      return
    }

    const cutoff = new Date(
      deps.clock().getTime() - deps.retentionDays * DAY_MS,
    )

    const deleted: Record<string, number> = {}
    for (const target of deps.targets) {
      // Uma tabela com erro não impede as outras: os lotes já apagados ficam apagados.
      deleted[target.name] = await purgeTarget(target, cutoff, deps)
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        retentionDays: deps.retentionDays,
        cutoff: cutoff.toISOString(),
        deleted,
      },
      '[FailureRetentionJob] Expurgo concluído',
    )
  } catch (error) {
    apiLogger.error(
      { app: 'thinkzap', err: error },
      '[FailureRetentionJob] Erro inesperado na rodada',
    )
  } finally {
    if (token) {
      await deps.lock
        .release(token)
        .catch(error =>
          apiLogger.warn(
            { app: 'thinkzap', err: error },
            '[FailureRetentionJob] Falha ao soltar o lock — expira pelo TTL',
          ),
        )
    }
  }
}

async function purgeTarget(
  target: RetentionTarget,
  cutoff: Date,
  deps: FailureRetentionJobDeps,
): Promise<number> {
  let total = 0

  try {
    for (let batch = 0; batch < deps.maxBatches; batch++) {
      const count = await target.deleteExpiredBatch(cutoff, deps.batchSize)
      total += count
      // Lote incompleto = acabou o que estava vencido.
      if (count < deps.batchSize) return total
    }

    apiLogger.warn(
      { app: 'thinkzap', target: target.name, deleted: total },
      '[FailureRetentionJob] Teto de lotes da rodada atingido — o resto sai na próxima',
    )
  } catch (error) {
    apiLogger.error(
      { app: 'thinkzap', target: target.name, deleted: total, err: error },
      '[FailureRetentionJob] Falha ao expurgar — retoma na próxima rodada',
    )
  }

  return total
}
