import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { CreateConnectorTemplateUseCase } from '../../application/create-connector-template'
import { CreateTemplateController } from '../../presentation/controllers/connector/create-template.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'
import { AxiosTemplateSampleImageFetcher } from '../../infra/adapters/axios-template-sample-image-fetcher.adapter'
import { makeTemplateImageStorage } from '../make-template-image-storage'
import { PrismaTemplateDefaultsRepository } from '../../infra/persistence/repositories/prisma-template-defaults.repository'

export const makeCreateTemplateController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new CreateConnectorTemplateUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
    new AxiosTemplateSampleImageFetcher(),
    makeTemplateImageStorage(),
    new PrismaTemplateDefaultsRepository(),
  )
  return Promise.resolve(new CreateTemplateController(useCase))
}
