import { Controller } from '@/shared/presentation/controller'
import { SendWidgetMessageController } from '../presentation/controllers/send-widget-message.controller'
import { makeEnqueueWidgetMessageUseCase } from './make-enqueue-widget-message-use-case'

/**
 * Deixou de receber `req`: o caminho de texto não toca o Bitrix no request. O cliente
 * Bitrix existia aqui só para o comentário de timeline, que migrou para o worker junto
 * com o envio.
 */
export const makeSendWidgetMessageController = (): Controller => {
  return new SendWidgetMessageController(makeEnqueueWidgetMessageUseCase())
}
