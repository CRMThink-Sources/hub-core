import { Queue } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const IMPORTSHEET_RUN = 'importsheet-run'

export type ImportSheetRunJob = {
  importId: number
  /** Origem do gatilho — só pra log/telemetria. */
  trigger: 'manual' | 'schedule' | 'continuation'
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

export async function enqueueImportRun(
  job: ImportSheetRunJob,
  options: EnqueueImportRunOptions = {},
) {
  // jobId fixo por importação: enquanto um run está pendente/ativo, o mesmo id
  // bloqueia enfileirar a mesma importação de novo (ex. ticks consecutivos do
  // poller antes do run terminar, ou o poller durante uma cadeia de páginas).
  // removeOn* limpa após terminar pra liberar a próxima página/run. Histórico de
  // erro fica na coluna last_error, não na fila.
  const createdJob = await importSheetRunQueue.add('run-import', job, {
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
