import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { UpdateConnectorTemplateUseCase } from '../../application/update-connector-template'
import { UpdateTemplateController } from '../../presentation/controllers/connector/update-template.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'
import { AxiosTemplateSampleImageFetcher } from '../../infra/adapters/axios-template-sample-image-fetcher.adapter'
import { makeTemplateImageStorage } from '../make-template-image-storage'
import { PrismaTemplateDefaultsRepository } from '../../infra/persistence/repositories/prisma-template-defaults.repository'

export const makeUpdateTemplateController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new UpdateConnectorTemplateUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
    new AxiosTemplateSampleImageFetcher(),
    makeTemplateImageStorage(),
    new PrismaTemplateDefaultsRepository(),
  )
  return Promise.resolve(new UpdateTemplateController(useCase))
}
