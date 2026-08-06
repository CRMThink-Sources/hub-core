import { Request } from 'express'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { ListWidgetTemplatesUseCase } from '../application/list-widget-templates'
import { WidgetTemplatesController } from '../presentation/controllers/widget-templates.controller'
import { makeTemplateProviderResolver } from './connector/make-template-provider-resolver'

export const makeListWidgetTemplatesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListWidgetTemplatesUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
  )
  return Promise.resolve(new WidgetTemplatesController(useCase))
}
