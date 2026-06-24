import { Worker } from 'bullmq'
import { redisConnection } from '@/queue/redis-connection'
import { workerLogger } from '@/shared/infra/logger'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { PrismaClickSignSettingsRepository } from '../persistence/repositories/prisma-clicksign-settings.repository'
import { HandleSignatureEventUseCase } from '../../application/handle-signature-event.use-case'
import {
  CLICKSIGN_DOCUMENT_CLOSED,
  type ClicksignDocumentClosedJob,
} from '../queue/clicksign-document-closed.queue'

const settingsRepository = new PrismaClickSignSettingsRepository()

const worker = new Worker<ClicksignDocumentClosedJob>(
  CLICKSIGN_DOCUMENT_CLOSED,
  async job => {
    const { appId, payload } = job.data
    const settings = await settingsRepository.findByAppId(appId)
    if (!settings) {
      workerLogger.warn(
        { app: 'clicksign', appId },
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
  { connection: redisConnection, concurrency: 1 },
)

worker.on('failed', (job, err) => {
  workerLogger.error(
    {
      app: 'clicksign',
      queue: CLICKSIGN_DOCUMENT_CLOSED,
      jobId: job?.id,
      appId: job?.data?.appId,
      error: err,
    },
    'Clicksign document_closed job failed',
  )
})

workerLogger.info({ app: 'clicksign' }, 'Clicksign worker is ready')
