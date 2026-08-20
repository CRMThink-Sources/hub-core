import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { SyncConnectorTemplatesUseCase } from '../../application/sync-connector-templates'
import { SyncTemplatesController } from '../../presentation/controllers/connector/sync-templates.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'

export const makeSyncTemplatesController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new SyncConnectorTemplatesUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
  )
  return Promise.resolve(new SyncTemplatesController(useCase))
}
