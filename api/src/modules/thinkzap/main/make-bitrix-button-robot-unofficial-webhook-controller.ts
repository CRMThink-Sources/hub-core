import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { Request } from 'express'
import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { EnqueueInteractiveButtonSendService } from '../application/enqueue-interactive-button-send.service'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '../infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '../infra/queue/bullmq-open-channel-conversation.queue'
import { ZApiClient } from '../infra/clients/z-api.client'
import { BitrixButtonRobotUnofficialWebhookHandlerController } from '../presentation/controllers/bitrix-button-robot-unofficial-webhook-handler.controller'
import { thinkzapError } from '../errors/catalog'

/** Mirror de `makeBitrixButtonRobotOfficialWebhookHandlerController`, para o robô não oficial (Z-API). */
export const makeBitrixButtonRobotUnofficialWebhookHandlerController = async (
  request: Request,
): Promise<Controller> => {
  const getDomain = new PrismaDomainRepository()
  const getApp = new PrismaInstalledAppRepository()

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

  const enqueueButtonSend = new EnqueueInteractiveButtonSendService(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
    new PrismaWidgetOutboxRepository(),
    new BullMqWidgetSendQueue(),
    makeDailySendQuota(),
  )

  return new BitrixButtonRobotUnofficialWebhookHandlerController(
    getDomain,
    getApp,
    enqueueButtonSend,
    new BitrixLivefeedNotificationService(bx),
    bx,
    makeInstallationLocaleRepository(),
  )
}
