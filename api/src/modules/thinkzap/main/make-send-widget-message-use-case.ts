import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { env } from '@/config/env'
import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { PrismaThinkzapMessageRepository } from '../infra/persistence/repositories/prisma-thinkzap-message.repository'

export const makeSendWidgetMessageUseCase = async (
  req: Request,
): Promise<SendWidgetMessageUseCase> => {
  const instanceRepository = new PrismaInstanceRepository()
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const bitrix = await makeBitrixClient(req)
  const sendBitrixNotification = new BitrixLivefeedNotificationService(bitrix)
  const messageRepo = new PrismaThinkzapMessageRepository()

  return new SendWidgetMessageUseCase(
    makeGetAplicationContext(),
    instanceRepository,
    zApiClient,
    sendBitrixNotification,
    messageRepo,
    bitrix,
  )
}
