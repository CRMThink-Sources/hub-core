import { Controller } from '@/shared/presentation/controller'
import { HubmessageWebhookHandlerController } from '../presentation/controllers/hubmessage-webhook-handler.controller'

export const makeHubmessageWebhookHandlerController = (): Controller => {
  return new HubmessageWebhookHandlerController()
}
