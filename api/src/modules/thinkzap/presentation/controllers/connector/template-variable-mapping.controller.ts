import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { GetTemplateVariableMappingUseCase } from '@/modules/thinkzap/application/get-template-variable-mapping'
import { SetTemplateVariableMappingUseCase } from '@/modules/thinkzap/application/set-template-variable-mapping'
import { parseLineRequest } from '../line/line-request'
import { handleTemplateError } from './list-templates.controller'
import { handleTemplateWriteError } from './template-write-errors'

const paramsSchema = z.object({
  name: z.string().min(1),
  language: z.string().min(1),
})

const entityTypeIdSchema = z.coerce.number().int().positive()

/**
 * `GET /thinkzap/lines/:itemId/templates/:name/:language/variable-mappings?entityTypeId=`
 * — o mapeamento salvo do template para o tipo de entidade (vazio se não houver).
 */
export class GetTemplateVariableMappingController extends Controller {
  constructor(private readonly useCase: GetTemplateVariableMappingUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = paramsSchema.parse(req.params)
    const entityTypeId = entityTypeIdSchema.parse(req.query.entityTypeId)
    const line = parseLineRequest(req)

    try {
      const result = await this.useCase.execute({
        domainId: line.domainId,
        subscriptionItemId: line.subscriptionItemId,
        name: params.name,
        language: params.language,
        entityTypeId,
      })
      return this.ok(result)
    } catch (error) {
      return handleTemplateError.call(this, error)
    }
  }
}

const bodySchema = z.object({
  entityTypeId: entityTypeIdSchema,
  mappings: z.record(
    z.string().min(1),
    z.object({
      source: z.enum(['self', 'contact', 'company']),
      fieldId: z.string(),
    }),
  ),
})

/**
 * `PUT /thinkzap/lines/:itemId/templates/:name/:language/variable-mappings` —
 * substitui o mapeamento do template para o tipo de entidade.
 */
export class SetTemplateVariableMappingController extends Controller {
  constructor(private readonly useCase: SetTemplateVariableMappingUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = paramsSchema.parse(req.params)
    const body = bodySchema.parse(req.body)

    try {
      const result = await this.useCase.execute({
        ...parseLineRequest(req),
        name: params.name,
        language: params.language,
        entityTypeId: body.entityTypeId,
        mappings: body.mappings,
      })
      return this.ok(result)
    } catch (error) {
      return handleTemplateWriteError.call(this, error)
    }
  }
}
