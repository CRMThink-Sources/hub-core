import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { BitrixEventHandler } from '@/shared/infra/handlers/bitrix-event-handler'
import { BitrixReceivedMessageHandler } from '@/shared/infra/handlers/bitrix/bitrix-received-message.handler'
import { BitrixMessageUpdateHandler } from '@/shared/infra/handlers/bitrix/bitrix-message-update.handler'
import { BitrixMessageDeleteHandler } from '@/shared/infra/handlers/bitrix/bitrix-message-delete.handler'
import { BitrixWebhookHandlerController } from '../presentation/controllers/bitrix-webhook-handler.controller'

export const makeBitrixWebhookHandlerController = (
  req: Request,
): Controller => {
  const bitrixEventRegistry = new EventRegistry<BitrixEventHandler>()

  bitrixEventRegistry.register(new BitrixReceivedMessageHandler())
  bitrixEventRegistry.register(new BitrixMessageUpdateHandler())
  bitrixEventRegistry.register(new BitrixMessageDeleteHandler())

  return new BitrixWebhookHandlerController(bitrixEventRegistry)
}
