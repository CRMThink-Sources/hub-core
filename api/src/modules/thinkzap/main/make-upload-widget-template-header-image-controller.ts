import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { UploadWidgetTemplateHeaderImageUseCase } from '../application/upload-widget-template-header-image'
import { UploadWidgetTemplateHeaderImageController } from '../presentation/controllers/upload-widget-template-header-image.controller'
import { makeTemplateImageStorage } from './make-template-image-storage'

export const makeUploadWidgetTemplateHeaderImageController = (
  _req: Request,
): Promise<Controller> =>
  Promise.resolve(
    new UploadWidgetTemplateHeaderImageController(
      new UploadWidgetTemplateHeaderImageUseCase(makeTemplateImageStorage()),
    ),
  )
