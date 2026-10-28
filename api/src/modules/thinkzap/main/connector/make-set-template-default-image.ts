import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { Request } from 'express'
import { SetTemplateDefaultImageUseCase } from '../../application/set-template-default-image'
import { SetTemplateDefaultImageController } from '../../presentation/controllers/connector/set-template-default-image.controller'
import { makeTemplateProviderResolver } from './make-template-provider-resolver'
import { AxiosTemplateSampleImageFetcher } from '../../infra/adapters/axios-template-sample-image-fetcher.adapter'
import { makeTemplateImageStorage } from '../make-template-image-storage'
import { PrismaTemplateDefaultsRepository } from '../../infra/persistence/repositories/prisma-template-defaults.repository'

export const makeSetTemplateDefaultImageController = (
  _req: Request,
): Promise<Controller> => {
  const useCase = new SetTemplateDefaultImageUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
    new AxiosTemplateSampleImageFetcher(),
    makeTemplateImageStorage(),
    new PrismaTemplateDefaultsRepository(),
  )
  return Promise.resolve(new SetTemplateDefaultImageController(useCase))
}
