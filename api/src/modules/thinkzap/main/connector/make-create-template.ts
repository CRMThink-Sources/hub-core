import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { CreateConnectorTemplateUseCase } from '../../application/create-connector-template'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { CreateTemplateController } from '../../presentation/controllers/connector/create-template.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'

export const makeCreateTemplateController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new CreateConnectorTemplateUseCase(
    new PrismaConnectorRepository(),
    new PrismaInstanceRepository(),
    makeTemplateProviderResolver(),
  )
  return Promise.resolve(new CreateTemplateController(useCase))
}
