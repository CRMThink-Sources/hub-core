import { randomUUID } from 'node:crypto'
import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { env } from '@/config/env'
import { workerLogger } from '@/shared/infra/logger'
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
  async job =>
    runWithLogContext({ traceKey: randomUUID() }, async () => {
      const imp = await importRepository.findByIdAny(job.data.importId)
      if (imp) await setTenantLogContext(imp.appId)

      const outcome = await runImportService.execute(job.data.importId)

      // 503 de intensidade (por IP): pausa a fila inteira por um instante e re-roda
      // o MESMO job sem contar como falha. `RateLimitError` é o mecanismo nativo.
      if (outcome.status === 'throttled-intensity') {
        await runWorker.rateLimit(outcome.pauseMs)
        throw Worker.RateLimitError()
      }
      return outcome
    }),
  { connection: redisConnection, concurrency: 1 },
)

// Continuação da paginação: re-enfileira a PRÓXIMA página. Roda no evento
// `completed` (jobId `import-${id}` já liberado pelo removeOnComplete), então a
// continuação entra no FIM da fila → round-robin natural entre importações.
runWorker.on('completed', (job, outcome) => {
  const importId = job.data.importId
  // Enqueue da continuação não pode falhar calado: sem ela a importação trava
  // em `running` (cursor parado no meio). Loga pra detectar o órfão.
  const enqueueContinuation = (delay?: number): void => {
    enqueueImportRun(
      { importId, trigger: 'continuation' },
      delay ? { delay } : undefined,
    ).catch(error =>
      workerLogger.error(
        { app: 'importsheet', queue: IMPORTSHEET_RUN, importId, err: error },
        'Failed to enqueue import continuation — import may be stuck',
      ),
    )
  }

  if (outcome?.status === 'continue') {
    // Vai pro fim da fila (round-robin); delay opcional espalha sob o limite do Bitrix.
    enqueueContinuation(env.importsheet.pageDelayMs || undefined)
    return
  }
  if (outcome?.status === 'throttled-operating') {
    // Budget de operating (por conta) → segura SÓ esta importação até o reset.
    const delay = outcome.resetAt
      ? Math.max(0, outcome.resetAt * 1000 - Date.now())
      : OPERATING_DEFAULT_DELAY_MS
    enqueueContinuation(delay)
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
      err,
    },
    'Import run job failed',
  )
})

// Órfã de crash: `running` com `lastRunAt` velho. 20min dá folga acima do delay
// legítimo do operating throttle (janela ~10min).
const STALE_RUNNING_MS = 20 * 60 * 1000

// Reclama imports presas em `running` (worker morto mid-página): marca `error` e
// reenfileira (retoma do cursor; `jobId import-${id}` evita duplicar).
async function reclaimStaleRunning(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS)
  const orphans = await importRepository.findStaleRunning(staleBefore)
  if (orphans.length === 0) return

  for (const imp of orphans) {
    // Preserva os erros por-linha acumulados pra seguirem reprocessáveis.
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

  workerLogger.warn(
    {
      app: 'importsheet',
      queue: IMPORTSHEET_SCHEDULER,
      reclaimed: orphans.length,
      importIds: orphans.map(o => o.id),
    },
    'Reclaimed stale running imports (worker crash recovery)',
  )
}

// --- Worker do scheduler: tick do poller (busca vencidas e enfileira). ---
const schedulerWorker = new Worker(
  IMPORTSHEET_SCHEDULER,
  async () =>
    runWithLogContext({ traceKey: randomUUID() }, async () => {
      // Lock garante tick único entre workers; auto-renova p/ não expirar no meio.
      await withRenewingLock(
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

          await reclaimStaleRunning()
        },
      )
    }),
  { connection: redisConnection, concurrency: 1 },
)

schedulerWorker.on('failed', (job, err) => {
  workerLogger.error(
    {
      app: 'importsheet',
      queue: IMPORTSHEET_SCHEDULER,
      jobId: job?.id,
      err,
    },
    'Scheduler tick failed',
  )
})

async function bootstrap(): Promise<void> {
  await ensureSchedulerTick()
  // Token Bitrix: a rota lê a credential fresca do banco por página; o refresh do
  // access_token é responsabilidade da rotina central da API (cron + buffer).
  workerLogger.info(
    { app: 'importsheet' },
    'ImportSheet worker is ready (run + scheduler)',
  )
}

void bootstrap()
