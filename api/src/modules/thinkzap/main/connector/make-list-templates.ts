import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { ListConnectorTemplatesUseCase } from '../../application/list-connector-templates'
import { ListTemplatesController } from '../../presentation/controllers/connector/list-templates.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'
import { PrismaTemplateDefaultsRepository } from '../../infra/persistence/repositories/prisma-template-defaults.repository'

export const makeListTemplatesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListConnectorTemplatesUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
    new PrismaTemplateDefaultsRepository(),
  )
  return Promise.resolve(new ListTemplatesController(useCase))
}
