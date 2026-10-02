import { randomUUID } from 'node:crypto'
import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import { env } from '@/config/env'
import { createWorkerLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '@/modules/importsheet/errors/catalog'
import { installBitrixLimits } from '@/shared/infra/bitrix-limits/install-bitrix-limits'
import { AppError } from '@/shared/domain/errors/app-error'
import { appErrorLogFields } from '@/shared/infra/log-error'
import { runWithLogContext } from '@/shared/infra/log-context'
import { setTenantLogContext } from '@/shared/infra/log-tenant'
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
import {
  parseImportError,
  serializeImportError,
} from '../application/import-error'
import { withRenewingLock } from '../infra/redis-lock'
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

const log = createWorkerLogger('importsheet')

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

// concurrency 1: o limite de intensidade do Bitrix é por IP, paralelizar só antecipa o 503.
const runWorker = new Worker<ImportSheetRunJob, ImportRunOutcome>(
  IMPORTSHEET_RUN,
  async job =>
    runWithLogContext(
      { traceKey: job.data.traceKey ?? randomUUID() },
      async () => {
        const imp = await importRepository.findByIdAny(job.data.importId)
        if (imp) await setTenantLogContext(imp.appId)

        const outcome = await runImportService.execute(job.data.importId)

        // Pausa a fila e re-roda o mesmo job sem contar como falha.
        if (outcome.status === 'throttled-intensity') {
          await runWorker.rateLimit(outcome.pauseMs)
          throw Worker.RateLimitError()
        }
        return outcome
      },
    ),
  { ...bullBaseOptions, concurrency: 1 },
)

// No `completed` o jobId já foi liberado: a próxima página vai pro fim da fila (round-robin).
runWorker.on('completed', (job, outcome) => {
  const importId = job.data.importId
  // Sem a continuação a importação trava em `running`; loga pra detectar o órfão.
  const enqueueContinuation = (delay?: number): void => {
    enqueueImportRun(
      { importId, trigger: 'continuation' },
      delay ? { delay } : undefined,
    ).catch(error =>
      logImportsheetError(
        log,
        'importsheet.run.continuation_enqueue_failed',
        {
          event: 'worker.job.enqueue_continuation_failed',
          queue: IMPORTSHEET_RUN,
          importId,
          err: error,
        },
        {
          level: 'error',
          msg: 'Failed to enqueue import continuation — import may be stuck',
        },
      ),
    )
  }

  if (outcome?.status === 'continue') {
    enqueueContinuation(env.importsheet.pageDelayMs || undefined)
    return
  }
  if (outcome?.status === 'throttled-operating') {
    // Budget de operating é por conta: segura só esta importação até o reset.
    const delay = outcome.resetAt
      ? Math.max(0, outcome.resetAt * 1000 - Date.now())
      : OPERATING_DEFAULT_DELAY_MS
    enqueueContinuation(delay)
  }
})

runWorker.on('failed', (job, err) => {
  const base = {
    event: 'worker.job.failed',
    queue: IMPORTSHEET_RUN,
    jobId: job?.id,
    importId: job?.data?.importId,
    attemptsMade: job?.attemptsMade,
  }
  const fields =
    err instanceof AppError
      ? appErrorLogFields(err, base)
      : { ...base, errorCode: 'UNCLASSIFIED', err }
  log.error(fields, 'Import run job failed')
})

// Folga acima do delay legítimo do operating throttle (~10min).
const STALE_RUNNING_MS = 20 * 60 * 1000

// Retoma do cursor; o jobId `import-${id}` evita enfileirar em duplicidade.
async function reclaimStaleRunning(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS)
  const orphans = await importRepository.findStaleRunning(staleBefore)
  if (orphans.length === 0) return

  for (const imp of orphans) {
    // Preserva os erros por linha pra seguirem reprocessáveis.
    const parsed = parseImportError(imp.lastError)
    const prior =
      parsed?.kind === 'partial'
        ? parsed.rows
        : parsed?.kind === 'fatal'
          ? (parsed.rows ?? [])
          : []
    await importRepository.markRunResult(imp.id, {
      startRow: imp.startRow,
      lastRunAt: new Date(),
      lastRunStatus: 'error',
      lastError: serializeImportError({
        kind: 'fatal',
        cursorRow: imp.startRow,
        message:
          'Execução interrompida (worker reiniciou) — retomada automática do cursor',
        ...(prior.length > 0 ? { rows: prior } : {}),
      }),
      nextRunAt: imp.nextRunAt,
    })
    if (imp.enabled) {
      await enqueueImportRun({ importId: imp.id, trigger: 'schedule' })
    }
  }

  logImportsheetError(
    log,
    'importsheet.run.stale_reclaimed',
    {
      event: 'worker.job.reclaimed',
      queue: IMPORTSHEET_SCHEDULER,
      reclaimed: orphans.length,
      importIds: orphans.map(o => o.id),
    },
    { msg: 'Reclaimed stale running imports (worker crash recovery)' },
  )
}

// O balde do Bitrix é por portal: sem o controle este worker gasta a cota dos outros.
installBitrixLimits()

const schedulerWorker = new Worker(
  IMPORTSHEET_SCHEDULER,
  async () =>
    runWithLogContext({ traceKey: randomUUID() }, async () => {
      await withRenewingLock(
        'importsheet:tick',
        SCHEDULER_TICK_EVERY_MS - 5000,
        async () => {
          const due = await importRepository.findDue(new Date())
          for (const imp of due) {
            await enqueueImportRun({ importId: imp.id, trigger: 'schedule' })
          }
          if (due.length > 0) {
            log.info(
              {
                event: 'queue.job.enqueued',
                queue: IMPORTSHEET_SCHEDULER,
                due: due.length,
              },
              'Scheduler tick enqueued due imports',
            )
          }

          await reclaimStaleRunning()
        },
      )
    }),
  { ...bullBaseOptions, concurrency: 1 },
)

schedulerWorker.on('failed', (job, err) => {
  const base = {
    event: 'worker.job.failed',
    queue: IMPORTSHEET_SCHEDULER,
    jobId: job?.id,
  }
  const fields =
    err instanceof AppError
      ? appErrorLogFields(err, base)
      : { ...base, errorCode: 'UNCLASSIFIED', err }
  log.error(fields, 'Scheduler tick failed')
})

async function bootstrap(): Promise<void> {
  await ensureSchedulerTick()
  // Refresh do token Bitrix é da rotina central da API; aqui só lê a credential por página.
  log.info(
    { event: 'worker.ready' },
    'ImportSheet worker is ready (run + scheduler)',
  )
}

void bootstrap()
