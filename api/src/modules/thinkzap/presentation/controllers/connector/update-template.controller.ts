import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { UpdateConnectorTemplateUseCase } from '@/modules/thinkzap/application/update-connector-template'
import { parseLineRequest } from '../line/line-request'
import {
  handleTemplateWriteError,
  requestBody,
  templateBodySchema,
} from './template-write-errors'

const templateIdSchema = z.string().min(1)

/**
 * `PUT /thinkzap/lines/:itemId/templates/:templateId` — edita template da linha.
 * Mesmo pedido da criação (JSON, ou multipart com a imagem em `headerImage`).
 */
export class UpdateTemplateController extends Controller {
  constructor(private readonly useCase: UpdateConnectorTemplateUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const templateId = templateIdSchema.safeParse(req.params.templateId)
    if (!templateId.success) {
      return this.badRequest(new Error('Invalid request: templateId'))
    }

    const raw = requestBody(req)
    if (raw instanceof Error) return this.badRequest(raw)

    const body = templateBodySchema.safeParse(raw)
    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      await this.useCase.execute({
        ...parseLineRequest(req),
        templateId: templateId.data,
        name: body.data.name,
        category: body.data.category,
        language: body.data.language,
        components: body.data.components,
        ...(req.file ? { headerImageFile: { data: req.file.buffer } } : {}),
      })
      return this.ok({ template: { id: templateId.data, status: 'PENDING' } })
    } catch (error) {
      return handleTemplateWriteError.call(this, error)
    }
  }
}
