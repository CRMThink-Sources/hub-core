import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { Request } from 'express'
import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { EnqueueTemplateSendService } from '../application/enqueue-template-send.service'
import { EnqueueWidgetMessageUseCase } from '../application/enqueue-widget-message.use-case'
import { ZApiClient } from '../infra/clients/z-api.client'
import { ListWidgetTemplatesUseCase } from '../application/list-widget-templates'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '../infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '../infra/queue/bullmq-open-channel-conversation.queue'
import { BitrixSmsProviderWebhookHandlerController } from '../presentation/controllers/bitrix-sms-provider-webhook-handler.controller'
import { thinkzapError } from '../errors/catalog'
import { makeTemplateProviderResolver } from './connector/make-template-provider-resolver'
import { makeTemplateSenderResolver } from './connector/make-template-sender-resolver'

/**
 * O cliente REST do Bitrix é resolvido aqui porque depende da instalação, que só se
 * conhece depois de ler o domínio do payload — e é ele que escreve o status da
 * mensagem de volta na tela de campanha. O controller relê domínio e app: a leitura é
 * barata e mantém a recusa `404` dentro dele, onde o teste a alcança.
 */
export const makeBitrixSmsProviderWebhookHandlerController = async (
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

  const instances = new PrismaInstanceRepository()
  const outbox = new PrismaWidgetOutboxRepository()
  const sendQueue = new BullMqWidgetSendQueue()

  return new BitrixSmsProviderWebhookHandlerController(
    getDomain,
    getApp,
    makeGetAplicationContext(),
    new EnqueueWidgetMessageUseCase(
      makeGetAplicationContext(),
      instances,
      new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
      outbox,
      sendQueue,
      makeDailySendQuota(),
    ),
    new EnqueueTemplateSendService(
      makeGetAplicationContext(),
      instances,
      makeTemplateSenderResolver(),
      outbox,
      sendQueue,
    ),
    new ListWidgetTemplatesUseCase(
      makeGetAplicationContext(),
      makeTemplateProviderResolver(),
    ),
    outbox,
    await makeBitrixClientByAppId(app.id),
  )
}
