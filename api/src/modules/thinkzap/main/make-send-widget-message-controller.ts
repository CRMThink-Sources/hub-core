import { Controller } from '@/shared/presentation/controller'
import { SendWidgetMessageController } from '../presentation/controllers/send-widget-message.controller'
import { makeSendWidgetMessageUseCase } from './make-send-widget-message-use-case'
import { Request } from 'express'

export const makeSendWidgetMessageController = async (
  req: Request,
): Promise<Controller> => {
  const sendWidgetMessage = await makeSendWidgetMessageUseCase(req)
  return new SendWidgetMessageController(sendWidgetMessage)
}
