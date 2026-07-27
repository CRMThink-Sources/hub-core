import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { SyncConnectorTemplatesUseCase } from '../../application/sync-connector-templates'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { SyncTemplatesController } from '../../presentation/controllers/connector/sync-templates.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'

export const makeSyncTemplatesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new SyncConnectorTemplatesUseCase(
    new PrismaConnectorRepository(),
    new PrismaInstanceRepository(),
    makeTemplateProviderResolver(),
  )
  return Promise.resolve(new SyncTemplatesController(useCase))
}
