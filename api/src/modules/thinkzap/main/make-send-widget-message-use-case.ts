import { EnqueueWidgetAttachments } from '@/modules/thinkzap/application/enqueue-widget-attachments'
import { makeOutboundMediaStorage } from '@/modules/thinkzap/main/make-outbound-media-storage'
import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { env } from '@/config/env'
import {
  BullMqOpenChannelConversationQueue,
  BullMqWidgetSendQueue,
} from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { Request } from 'express'
import { PrismaThinkzapMessageRepository } from '../infra/persistence/repositories/prisma-thinkzap-message.repository'
import { prepareOpenLineOutboundText } from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'

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
    new BullMqOpenChannelConversationQueue(),
    /**
     * O mesmo preparo do canal aberto, com o cliente Bitrix que a rota já tem em
     * mãos: sem ele, este caminho entregaria sem prefixo enquanto o canal aberto
     * prefixa — a mesma configuração de linha com dois comportamentos.
     */
    input =>
      prepareOpenLineOutboundText({
        ...input,
        getBitrixUserDisplayName: new BitrixGetUserDisplayNameAdapter(bitrix),
        getAllowedUser: new PrismaAllowedUserRepository(),
      }),
    makeDailySendQuota(),
    makeInstallationLocaleRepository(),
    makeQueuedWidgetAttachments(),
  )
}

/** `null` sem a guarda privada dos anexos: o envio com anexo segue síncrono. */
function makeQueuedWidgetAttachments(): EnqueueWidgetAttachments | null {
  const storage = makeOutboundMediaStorage()
  if (!storage) return null
  return new EnqueueWidgetAttachments({
    outbox: new PrismaWidgetOutboxRepository(),
    storage,
    sendQueue: new BullMqWidgetSendQueue(),
    cadence: makeSendCadence(),
  })
}
