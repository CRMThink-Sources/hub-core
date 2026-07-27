import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { ListConnectorTemplatesUseCase } from '../../application/list-connector-templates'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { ListTemplatesController } from '../../presentation/controllers/connector/list-templates.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'

export const makeListTemplatesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new ListConnectorTemplatesUseCase(
    new PrismaConnectorRepository(),
    new PrismaInstanceRepository(),
    makeTemplateProviderResolver(),
  )
  return Promise.resolve(new ListTemplatesController(useCase))
}
