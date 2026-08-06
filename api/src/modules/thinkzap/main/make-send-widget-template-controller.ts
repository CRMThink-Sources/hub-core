import { Request } from 'express'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { SendWidgetTemplateUseCase } from '@/modules/thinkzap/application/send-widget-template.use-case'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Controller } from '@/shared/presentation/controller'
import { PrismaThinkzapMessageRepository } from '../infra/persistence/repositories/prisma-thinkzap-message.repository'
import { SendWidgetTemplateController } from '../presentation/controllers/send-widget-template.controller'
import { makeTemplateSenderResolver } from './connector/make-template-sender-resolver'

export const makeSendWidgetTemplateController = async (
  req: Request,
): Promise<Controller> => {
  const bitrix = await makeBitrixClient(req)

  const useCase = new SendWidgetTemplateUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    makeTemplateSenderResolver(),
    new BitrixLivefeedNotificationService(bitrix),
    new PrismaThinkzapMessageRepository(),
  )

  return new SendWidgetTemplateController(useCase)
}
