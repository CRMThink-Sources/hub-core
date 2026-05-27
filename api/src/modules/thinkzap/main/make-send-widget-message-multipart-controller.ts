import { Controller } from '@/shared/presentation/controller'
import { SendWidgetMessageMultipartController } from '../presentation/controllers/send-widget-message-multipart.controller'
import { makeSendWidgetMessageUseCase } from './make-send-widget-message-use-case'
import { Request } from 'express'

export const makeSendWidgetMessageMultipartController = async (
  req: Request,
): Promise<Controller> => {
  const sendWidgetMessage = await makeSendWidgetMessageUseCase(req)
  return new SendWidgetMessageMultipartController(sendWidgetMessage)
}
