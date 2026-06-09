import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { workerLogger } from '@/shared/infra/logger'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { GoogleOAuthClient } from '../infra/clients/google-oauth.client'
import { GoogleSheetsClient } from '../infra/clients/google-sheets.client'
import { PrismaImportSheetAuthTokenRepository } from '../infra/persistence/repositories/prisma-importsheet-auth-token.repository'
import { PrismaImportSheetImportRepository } from '../infra/persistence/repositories/prisma-importsheet-import.repository'
import { GoogleConnectionService } from '../application/google-connection.service'
import {
  RunImportService,
  type ImportRunOutcome,
} from '../application/run-import.service'
import { OPERATING_DEFAULT_DELAY_MS } from '../application/bitrix-throttle'
import { withLock } from '../infra/redis-lock'
import {
  IMPORTSHEET_RUN,
  enqueueImportRun,
  type ImportSheetRunJob,
} from '../queue/importsheet-run.queue'
import {
  IMPORTSHEET_SCHEDULER,
  SCHEDULER_TICK_EVERY_MS,
  ensureSchedulerTick,
} from '../queue/importsheet-scheduler.queue'

const importRepository = new PrismaImportSheetImportRepository()

const connectionService = new GoogleConnectionService(
  new GoogleOAuthClient(),
  new PrismaImportSheetAuthTokenRepository(),
)

const runImportService = new RunImportService(
  importRepository,
  connectionService,
  new GoogleSheetsClient(),
  async (appId: string) =>
    (await makeBitrixClientByAppId(appId)) as BitrixClient,
)

// --- Worker de execução: processa UMA página por job. ---
// concurrency 1: o limite de intensidade do Bitrix é por IP (compartilhado entre
// todas as contas a partir deste servidor), então paralelizar só antecipa o 503.
const runWorker = new Worker<ImportSheetRunJob, ImportRunOutcome>(
  IMPORTSHEET_RUN,
  async job => {
    const continuation = job.data.trigger === 'continuation'
    const outcome = await runImportService.execute(
      job.data.importId,
      continuation,
    )

    // 503 de intensidade (por IP): pausa a fila inteira por um instante e re-roda
    // o MESMO job sem contar como falha. `RateLimitError` é o mecanismo nativo.
    if (outcome.status === 'throttled-intensity') {
      await runWorker.rateLimit(outcome.pauseMs)
      throw Worker.RateLimitError()
    }
    return outcome
  },
  { connection: redisConnection, concurrency: 1 },
)

// Continuação da paginação: re-enfileira a PRÓXIMA página. Roda no evento
// `completed` (jobId `import-${id}` já liberado pelo removeOnComplete), então a
// continuação entra no FIM da fila → round-robin natural entre importações.
runWorker.on('completed', (job, outcome) => {
  const importId = job.data.importId
  if (outcome?.status === 'continue') {
    // Continuação vai pro fim da fila (round-robin entre importações).
    void enqueueImportRun({ importId, trigger: 'continuation' })
    return
  }
  if (outcome?.status === 'throttled-operating') {
    // Budget de operating (por conta) → segura SÓ esta importação até o reset.
    const delay = outcome.resetAt
      ? Math.max(0, outcome.resetAt * 1000 - Date.now())
      : OPERATING_DEFAULT_DELAY_MS
    void enqueueImportRun({ importId, trigger: 'continuation' }, { delay })
  }
})

runWorker.on('failed', (job, err) => {
  workerLogger.error(
    {
      app: 'importsheet',
      queue: IMPORTSHEET_RUN,
      jobId: job?.id,
      importId: job?.data?.importId,
      attemptsMade: job?.attemptsMade,
      error: err,
    },
    'Import run job failed',
  )
})

// --- Worker do scheduler: tick do poller (busca vencidas e enfileira). ---
const schedulerWorker = new Worker(
  IMPORTSHEET_SCHEDULER,
  async () => {
    // Lock garante tick único mesmo com vários processos worker.
    await withLock(
      'importsheet:tick',
      SCHEDULER_TICK_EVERY_MS - 5000,
      async () => {
        const due = await importRepository.findDue(new Date())
        for (const imp of due) {
          await enqueueImportRun({ importId: imp.id, trigger: 'schedule' })
        }
        if (due.length > 0) {
          workerLogger.info(
            {
              app: 'importsheet',
              queue: IMPORTSHEET_SCHEDULER,
              due: due.length,
            },
            'Scheduler tick enqueued due imports',
          )
        }
      },
    )
  },
  { connection: redisConnection, concurrency: 1 },
)

schedulerWorker.on('failed', (job, err) => {
  workerLogger.error(
    {
      app: 'importsheet',
      queue: IMPORTSHEET_SCHEDULER,
      jobId: job?.id,
      error: err,
    },
    'Scheduler tick failed',
  )
})

async function bootstrap(): Promise<void> {
  await ensureSchedulerTick()
  workerLogger.info(
    { app: 'importsheet' },
    'ImportSheet worker is ready (run + scheduler)',
  )
}

void bootstrap()
