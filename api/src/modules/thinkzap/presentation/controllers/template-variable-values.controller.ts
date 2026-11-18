import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { ResolveTemplateVariableValuesUseCase } from '@/modules/thinkzap/application/resolve-template-variable-values'
import { entityTypeIdFromWidgetEntity } from '@/modules/thinkzap/domain/template-variable-mapping'

const schema = z.object({
  subscriptionItemId: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  domainId: z.string().min(1),
})

/**
 * `GET /api/thinkzap/messages/widget-templates/:subscriptionItemId/:name/:language/variable-values?entity=&entityId=`
 * — os valores iniciais das variáveis do template para o registro em que o widget
 * está aberto.
 *
 * Mora no bloco do widget, **sem** permissão de conector, como o catálogo de
 * templates: quem manda a mensagem não administra conectores. A instalação vem do
 * JWT; o mapeamento é lido pela instalação, então a rota não alcança linha de outra.
 *
 * Nunca responde erro por causa do CRM — a falha vira `values: {}` no use case.
 */
export class TemplateVariableValuesController extends Controller {
  constructor(private readonly useCase: ResolveTemplateVariableValuesUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = schema.parse({
      subscriptionItemId: req.params.subscriptionItemId,
      name: req.params.name,
      language: req.params.language,
      entity: req.query.entity,
      entityId: req.query.entityId,
      domainId: req.domainId,
    })

    const entityTypeId = entityTypeIdFromWidgetEntity(input.entity)
    if (entityTypeId === null) {
      return this.badRequest(
        new Error('Tipo de entidade do CRM não reconhecido'),
      )
    }

    const result = await this.useCase.execute({
      domainId: input.domainId,
      subscriptionItemId: input.subscriptionItemId,
      name: input.name,
      language: input.language,
      entityTypeId,
      entityId: input.entityId,
    })
    return this.ok(result)
  }
}
