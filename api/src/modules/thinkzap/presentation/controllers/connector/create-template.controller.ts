import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'

import { CreateConnectorTemplateUseCase } from '@/modules/thinkzap/application/create-connector-template'
import { parseLineRequest } from '../line/line-request'
import {
  handleTemplateWriteError,
  requestBody,
  templateBodySchema,
} from './template-write-errors'

export {
  headerImageRejectionMessage,
  isMissingAppCredentials,
  isTemplateMediaRouteUnavailable,
} from './template-write-errors'

/** `POST /thinkzap/lines/:itemId/templates` — cadastra template da linha. */
export class CreateTemplateController extends Controller {
  constructor(private readonly useCase: CreateConnectorTemplateUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const raw = requestBody(req)
    if (raw instanceof Error) return this.badRequest(raw)

    const body = templateBodySchema.safeParse(raw)
    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      const created = await this.useCase.execute({
        ...parseLineRequest(req),
        name: body.data.name,
        category: body.data.category,
        language: body.data.language,
        components: body.data.components,
        ...(req.file ? { headerImageFile: { data: req.file.buffer } } : {}),
      })
      return this.ok({ template: created })
    } catch (error) {
      return handleTemplateWriteError.call(this, error)
    }
  }
}
