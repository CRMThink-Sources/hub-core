import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { Request } from 'express'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { EnqueueTemplateSendService } from '../application/enqueue-template-send.service'
import { ListWidgetTemplatesUseCase } from '../application/list-widget-templates'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '../infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '../infra/queue/bullmq-open-channel-conversation.queue'
import { BitrixTemplateRobotWebhookHandlerController } from '../presentation/controllers/bitrix-template-robot-webhook-handler.controller'
import { thinkzapError } from '../errors/catalog'
import { makeTemplateProviderResolver } from './connector/make-template-provider-resolver'
import { makeTemplateSenderResolver } from './connector/make-template-sender-resolver'

/**
 * O cliente Bitrix é resolvido aqui, e não dentro do controller, pelo mesmo motivo do
 * robô de envio livre: ele depende da instalação, que só se conhece depois de ler o
 * domínio do payload. O controller relê domínio e app — a leitura é barata e mantém a
 * recusa `404` dentro dele, onde o teste a alcança.
 */
export const makeBitrixTemplateRobotWebhookHandlerController = async (
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

  const enqueueTemplateSend = new EnqueueTemplateSendService(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    makeTemplateSenderResolver(),
    new PrismaWidgetOutboxRepository(),
    new BullMqWidgetSendQueue(),
  )

  return new BitrixTemplateRobotWebhookHandlerController(
    getDomain,
    getApp,
    enqueueTemplateSend,
    new ListWidgetTemplatesUseCase(
      makeGetAplicationContext(),
      makeTemplateProviderResolver(),
    ),
    new BitrixLivefeedNotificationService(bx),
    bx,
    makeInstallationLocaleRepository(),
  )
}
