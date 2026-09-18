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
import { BitrixButtonRobotOfficialWebhookHandlerController } from '../presentation/controllers/bitrix-button-robot-official-webhook-handler.controller'
import { thinkzapError } from '../errors/catalog'

/**
 * Mirror de `makeBitrixTemplateRobotWebhookHandlerController` — mesmo
 * raciocínio de resolver o cliente Bitrix aqui, fora do controller. O
 * `ZApiClient` entra na composição mesmo este robô sendo só para linha
 * oficial: `EnqueueInteractiveButtonSendService` é o mesmo serviço
 * compartilhado com o robô não oficial, e resolve linha de qualquer provider
 * — a checagem de provider certo é do controller, não do serviço.
 */
export const makeBitrixButtonRobotOfficialWebhookHandlerController = async (
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
  )

  return new BitrixButtonRobotOfficialWebhookHandlerController(
    getDomain,
    getApp,
    enqueueButtonSend,
    new BitrixLivefeedNotificationService(bx),
    bx,
  )
}
