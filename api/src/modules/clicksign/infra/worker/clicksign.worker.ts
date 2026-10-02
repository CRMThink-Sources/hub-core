import { randomUUID } from 'node:crypto'
import { Worker } from 'bullmq'
import { bullBaseOptions } from '@/queue/redis-connection'
import { createWorkerLogger } from '@/shared/infra/logger'
import { installBitrixLimits } from '@/shared/infra/bitrix-limits/install-bitrix-limits'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { PrismaClickSignSettingsRepository } from '../persistence/repositories/prisma-clicksign-settings.repository'
import { HandleSignatureEventUseCase } from '../../application/handle-signature-event.use-case'
import { runWithLogContext } from '@/shared/infra/log-context'
import { setTenantLogContext } from '@/shared/infra/log-tenant'
import { safeErrorMessage } from '../clients/clicksign-error'
import { AppError } from '@/shared/domain/errors/app-error'
import { appErrorLogFields } from '@/shared/infra/log-error'
import { logClicksignError } from '../../errors/catalog'
import {
  CLICKSIGN_DOCUMENT_CLOSED,
  type ClicksignDocumentClosedJob,
} from '../queue/clicksign-document-closed.queue'

const log = createWorkerLogger('clicksign')

const settingsRepository = new PrismaClickSignSettingsRepository()

// O balde de requests do Bitrix é por portal: sem isso o worker gasta a cota dos outros.
installBitrixLimits()

const worker = new Worker<ClicksignDocumentClosedJob>(
  CLICKSIGN_DOCUMENT_CLOSED,
  job =>
    runWithLogContext(
      { traceKey: job.data.traceKey ?? randomUUID() },
      async () => {
        const { appId, payload } = job.data
        await setTenantLogContext(appId)

        const settings = await settingsRepository.findByAppId(appId)
        if (!settings) {
          logClicksignError(
            log,
            'clicksign.worker.settings_missing',
            { event: 'worker.job.skipped' },
            { msg: 'Settings não encontradas — pulando document_closed' },
          )
          return
        }
        const bitrix = (await makeBitrixClientByAppId(appId)) as BitrixClient
        await new HandleSignatureEventUseCase(
          bitrix,
          settings,
        ).handleDocumentClosed(payload)
      },
    ),
  { ...bullBaseOptions, concurrency: 1 },
)

worker.on('failed', (job, err) => {
  const base = {
    event: 'worker.job.failed',
    queue: CLICKSIGN_DOCUMENT_CLOSED,
    jobId: job?.id,
    appId: job?.data?.appId,
  }
  if (err instanceof AppError) {
    log.error(
      appErrorLogFields(err, base),
      'Clicksign document_closed job failed',
    )
    return
  }
  logClicksignError(
    log,
    'clicksign.worker.job_failed',
    { ...base, err: safeErrorMessage(err) },
    { level: 'error', msg: 'Clicksign document_closed job failed' },
  )
})

log.info({ event: 'worker.ready' }, 'Clicksign worker is ready')
