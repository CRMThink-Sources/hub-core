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
import {
  CLICKSIGN_DOCUMENT_CLOSED,
  type ClicksignDocumentClosedJob,
} from '../queue/clicksign-document-closed.queue'

const log = createWorkerLogger('clicksign')

const settingsRepository = new PrismaClickSignSettingsRepository()

// O balde de request do Bitrix e por portal: worker que chama o Bitrix sem
// instalar o controle gasta a cota dos outros sem contar.
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
          log.warn(
            { event: 'worker.job.skipped' },
            'Settings não encontradas — pulando document_closed',
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
  const fields =
    err instanceof AppError
      ? appErrorLogFields(err, base)
      : { ...base, errorCode: 'UNCLASSIFIED', err: safeErrorMessage(err) }
  log.error(fields, 'Clicksign document_closed job failed')
})

log.info({ event: 'worker.ready' }, 'Clicksign worker is ready')
