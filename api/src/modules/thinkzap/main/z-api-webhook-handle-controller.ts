import { Controller } from '@/shared/presentation/controller'
import { ZApiWebhookHandlerController } from '../presentation/controllers/z-api-webhook-handler.controller'
import { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { ZApiEventHandler } from '@/shared/infra/handlers/z-api-event-handler'
import { ReceivedMessageHandler } from '@/shared/infra/handlers/z-api/received-message.handler'
import { ZApiConnectedHandler } from '@/shared/infra/handlers/z-api/connected.handler'
import { ZApiDisconectedHandler } from '@/shared/infra/handlers/z-api/disconected.handler'
import { StatusCallbackHandler } from '@/shared/infra/handlers/z-api/status-callback.handler'

export const makeZApiWebhookHandlerController = (): Controller => {
  const zApiEventRegistry = new EventRegistry<ZApiEventHandler>()

  zApiEventRegistry.register(new ReceivedMessageHandler())
  zApiEventRegistry.register(new ZApiConnectedHandler())
  zApiEventRegistry.register(new ZApiDisconectedHandler())
  zApiEventRegistry.register(new StatusCallbackHandler())

  return new ZApiWebhookHandlerController(zApiEventRegistry)
}
