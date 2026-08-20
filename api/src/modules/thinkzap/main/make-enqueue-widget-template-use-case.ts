import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { EnqueueWidgetTemplateUseCase } from '@/modules/thinkzap/application/enqueue-widget-template.use-case'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { makeTemplateSenderResolver } from './connector/make-template-sender-resolver'

/**
 * Sem `req`: este caminho não fala com o Bitrix. O comentário de timeline migrou para o
 * worker junto com o envio, e era ele a única razão de o cliente Bitrix existir aqui —
 * mesma coisa que aconteceu com o envio livre.
 */
export const makeEnqueueWidgetTemplateUseCase =
  (): EnqueueWidgetTemplateUseCase => {
    return new EnqueueWidgetTemplateUseCase(
      makeGetAplicationContext(),
      new PrismaInstanceRepository(),
      makeTemplateSenderResolver(),
      new PrismaWidgetOutboxRepository(),
      new BullMqWidgetSendQueue(),
    )
  }
