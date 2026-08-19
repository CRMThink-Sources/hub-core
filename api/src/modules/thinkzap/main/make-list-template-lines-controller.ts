import { Request } from 'express'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Controller } from '@/shared/presentation/controller'
import { ListTemplateLinesUseCase } from '../application/list-template-lines'
import { TemplateLinesController } from '../presentation/controllers/template-lines.controller'

export const makeListTemplateLinesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListTemplateLinesUseCase(makeGetAplicationContext())

  return Promise.resolve(new TemplateLinesController(useCase))
}
