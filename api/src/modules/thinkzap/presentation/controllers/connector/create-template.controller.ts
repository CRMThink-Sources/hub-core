import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
} from '@/modules/thinkzap/application/create-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { handleTemplateError } from './list-templates.controller'
import { parseLineRequest } from '../line/line-request'

const componentSchema = z
  .object({
    type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
    text: z.string().optional(),
  })
  .passthrough()

const bodySchema = z.object({
  name: z.string().min(1),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  language: z.string().min(1),
  components: z.array(componentSchema).min(1),
})

/** `POST /thinkzap/lines/:itemId/templates` — cadastra template da linha. */
export class CreateTemplateController extends Controller {
  constructor(private readonly useCase: CreateConnectorTemplateUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const body = bodySchema.safeParse(req.body)
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
      })
      return this.ok({ template: created })
    } catch (error) {
      if (error instanceof InvalidTemplateError) {
        return this.badRequest(error)
      }
      // Rejeição de negócio da Meta: propaga a mensagem legível sem mascarar.
      if (error instanceof HubMessageApiError) {
        return this.badRequest(new Error(error.message))
      }
      return handleTemplateError.call(this, error)
    }
  }
}
