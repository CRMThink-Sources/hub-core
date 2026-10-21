import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { env } from '@/config/env'
import { EnqueueWidgetMessageUseCase } from '@/modules/thinkzap/application/enqueue-widget-message.use-case'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'

/**
 * Sem `req`: este caminho não fala com o Bitrix. O comentário de timeline migrou para o
 * worker junto com o envio, e era ele a única razão de o cliente Bitrix existir aqui.
 */
export const makeEnqueueWidgetMessageUseCase =
  (): EnqueueWidgetMessageUseCase => {
    return new EnqueueWidgetMessageUseCase(
      makeGetAplicationContext(),
      new PrismaInstanceRepository(),
      new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
      new PrismaWidgetOutboxRepository(),
      new BullMqWidgetSendQueue(),
      makeDailySendQuota(),
      makeSendCadence(),
    )
  }
