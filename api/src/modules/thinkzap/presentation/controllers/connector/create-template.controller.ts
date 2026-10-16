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
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const componentSchema = z
  .object({
    type: z.enum(['HEADER', 'BODY', 'FOOTER']),
    text: z.string().optional(),
  })
  .passthrough()

/**
 * Forma de cada tipo de botão. Os limites (quantidade, tamanho, categoria) ficam em
 * `validateTemplateButtons`, no use case — aqui só o formato do pedido.
 */
const buttonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: z.string() }),
  z.object({
    type: z.literal('URL'),
    text: z.string(),
    url: z.string(),
    example: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('PHONE_NUMBER'),
    text: z.string(),
    phone_number: z.string(),
  }),
  z.object({ type: z.literal('COPY_CODE'), example: z.string() }),
])

const buttonsComponentSchema = z.object({
  type: z.literal('BUTTONS'),
  buttons: z.array(buttonSchema).min(1),
})

const bodySchema = z.object({
  name: z.string().min(1),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  language: z.string().min(1),
  components: z
    .array(z.union([buttonsComponentSchema, componentSchema]))
    .min(1),
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
        logThinkzapError(
          apiLogger,
          'thinkzap.template.invalid_definition',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      // Rejeição de negócio da Meta: propaga a mensagem legível sem mascarar.
      if (error instanceof HubMessageApiError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.template.provider_rejected',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(new Error(error.message))
      }
      return handleTemplateError.call(this, error)
    }
  }
}
