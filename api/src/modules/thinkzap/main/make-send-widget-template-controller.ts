import { Controller } from '@/shared/presentation/controller'
import { SendWidgetTemplateController } from '../presentation/controllers/send-widget-template.controller'
import { makeEnqueueWidgetTemplateUseCase } from './make-enqueue-widget-template-use-case'

/**
 * Deixou de receber `req`: o envio de template não toca o Bitrix no request. O cliente
 * Bitrix existia aqui só para o comentário de timeline, que migrou para o worker junto
 * com o envio — mesma trajetória do envio livre.
 */
export const makeSendWidgetTemplateController = (): Controller => {
  return new SendWidgetTemplateController(makeEnqueueWidgetTemplateUseCase())
}
