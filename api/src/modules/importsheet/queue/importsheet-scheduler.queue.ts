import { Queue } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'

export const IMPORTSHEET_SCHEDULER = 'importsheet-scheduler'

/** Nome do job repeatable do tick. */
export const SCHEDULER_TICK = 'scheduler-tick'

/** Intervalo do poller — varre importações vencidas. */
export const SCHEDULER_TICK_EVERY_MS = 60 * 1000

export const importSheetSchedulerQueue = new Queue(
  IMPORTSHEET_SCHEDULER,
  bullBaseOptions,
)

/**
 * Garante o job repeatable do tick. Idempotente: o BullMQ deduplica pelo
 * nome + opção de repeat, então pode ser chamado a cada boot do worker.
 */
export async function ensureSchedulerTick(): Promise<void> {
  await importSheetSchedulerQueue.add(
    SCHEDULER_TICK,
    {},
    {
      repeat: { every: SCHEDULER_TICK_EVERY_MS },
      removeOnComplete: true,
      removeOnFail: true,
    },
  )
}
