import { Controller } from '@/shared/presentation/controller'
import { BitrixBotWebhookHandlerController } from '../presentation/controllers/bitrix-bot-webhook-handler.controller'

export const makeBitrixBotWebhookHandlerController = (): Controller => {
  return new BitrixBotWebhookHandlerController()
}
