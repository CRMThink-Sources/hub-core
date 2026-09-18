import { Controller } from '@/shared/presentation/controller'
import { SendWidgetButtonController } from '../presentation/controllers/send-widget-button.controller'
import { makeEnqueueWidgetButtonUseCase } from './make-enqueue-widget-button-use-case'

export const makeSendWidgetButtonController = (): Controller => {
  return new SendWidgetButtonController(makeEnqueueWidgetButtonUseCase())
}
