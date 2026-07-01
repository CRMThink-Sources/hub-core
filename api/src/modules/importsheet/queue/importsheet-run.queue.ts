import { Queue } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import { getLogContext } from '@/shared/infra/log-context'

export const IMPORTSHEET_RUN = 'importsheet-run'

export type ImportSheetRunJob = {
  importId: number
  /** Origem do gatilho — só pra log/telemetria. */
  trigger: 'manual' | 'schedule' | 'continuation'
  // Propaga o traceKey do request/run anterior p/ o job — amarra API↔worker.
  traceKey?: string
}

export type EnqueueImportRunOptions = {
  /** Atraso antes da página rodar (ms) — usado no throttle de operating. */
  delay?: number
}

export const importSheetRunQueue = new Queue<ImportSheetRunJob>(
  IMPORTSHEET_RUN,
  {
    connection: redisConnection,
  },
)

/**
 * Há um run pendente/ativo pra essa importação? Estados waiting/active/delayed
 * = job em voo (jobId fixo `import-<id>`). Usado pra barrar reenfileiramento
 * manual antes de o run atual terminar.
 */
export async function isImportRunInFlight(importId: number): Promise<boolean> {
  const job = await importSheetRunQueue.getJob(`import-${importId}`)
  if (!job) return false
  const state = await job.getState()
  return state === 'waiting' || state === 'active' || state === 'delayed'
}

export async function enqueueImportRun(
  job: ImportSheetRunJob,
  options: EnqueueImportRunOptions = {},
) {
  // jobId fixo por importação: enquanto um run está pendente/ativo, o mesmo id
  // bloqueia enfileirar a mesma importação de novo (ex. ticks consecutivos do
  // poller antes do run terminar, ou o poller durante uma cadeia de páginas).
  // removeOn* limpa após terminar pra liberar a próxima página/run. Histórico de
  // erro fica na coluna last_error, não na fila.
  const enriched = {
    ...job,
    traceKey: job.traceKey ?? getLogContext().traceKey,
  }
  const createdJob = await importSheetRunQueue.add('run-import', enriched, {
    jobId: `import-${job.importId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
    ...(options.delay ? { delay: options.delay } : {}),
  })

  apiLogger.info(
    {
      app: 'importsheet',
      queue: IMPORTSHEET_RUN,
      jobId: createdJob.id,
      importId: job.importId,
      trigger: job.trigger,
    },
    'Import run job enqueued',
  )

  return createdJob
}
