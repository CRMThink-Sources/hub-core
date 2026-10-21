import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { EnqueueWidgetButtonUseCase } from '@/modules/thinkzap/application/enqueue-widget-button.use-case'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

/**
 * Sem `req`: este caminho não fala com o Bitrix no request — mirror de
 * `makeEnqueueWidgetTemplateUseCase`.
 */
export const makeEnqueueWidgetButtonUseCase =
  (): EnqueueWidgetButtonUseCase => {
    return new EnqueueWidgetButtonUseCase(
      makeGetAplicationContext(),
      new PrismaInstanceRepository(),
      new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
      new PrismaWidgetOutboxRepository(),
      new BullMqWidgetSendQueue(),
      makeDailySendQuota(),
      makeSendCadence(),
    )
  }
