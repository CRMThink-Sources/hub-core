import { EnqueueRobotMessage } from '@/modules/thinkzap/application/enqueue-robot-message'
import { makeOutboundMediaStorage } from '@/modules/thinkzap/main/make-outbound-media-storage'
import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { BitrixRobotWebhookHandlerController } from '../presentation/controllers/bitrix-robot-webhook-handler.controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import {
  makeBitrixClient,
  makeBitrixClientByAppId,
} from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { thinkzapError } from '../errors/catalog'

export const makeBitrixRobotWebhookHandlerController = async (
  request: Request,
): Promise<Controller> => {
  const getDomain = new PrismaDomainRepository()
  const getApp = new PrismaInstalledAppRepository()
  const getConnector = new PrismaConnectorRepository()
  const getInstance = new PrismaInstanceRepository()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  const domain = await getDomain.getDomain(request.body.auth.domain)
  if (!domain) {
    throw thinkzapError('thinkzap.app.not_found')
  }
  const app = await getApp.getByAppCodeAndDomainId(
    'crmthink.thinkzap',
    domain.id,
  )
  if (!app) {
    throw thinkzapError('thinkzap.app.not_found')
  }
  const bx = await makeBitrixClientByAppId(app.id)
  const sendNotification = new BitrixLivefeedNotificationService(bx)

  return new BitrixRobotWebhookHandlerController(
    getDomain,
    getApp,
    makeGetAplicationContext(),
    sendNotification,
    bx,
    makeDailySendQuota(),
    makeInstallationLocaleRepository(),
    null,
    makeQueuedRobotMessage(getInstance),
  )
}

/** `null` sem a guarda privada dos arquivos: o robô segue síncrono. */
function makeQueuedRobotMessage(
  instances: PrismaInstanceRepository,
): EnqueueRobotMessage | null {
  const storage = makeOutboundMediaStorage()
  if (!storage) return null
  return new EnqueueRobotMessage({
    outbox: new PrismaWidgetOutboxRepository(),
    storage,
    sendQueue: new BullMqWidgetSendQueue(),
    cadence: makeSendCadence(),
    instances,
  })
}
