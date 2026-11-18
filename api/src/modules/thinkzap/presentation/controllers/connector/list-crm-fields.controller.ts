import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { ListCrmEntityTypesUseCase } from '@/modules/thinkzap/application/list-crm-entity-types'
import { ListCrmFieldsUseCase } from '@/modules/thinkzap/application/list-crm-fields'

const querySchema = z.object({
  entityTypeId: z.coerce.number().int().positive(),
})

/**
 * `GET /thinkzap/crm-fields?entityTypeId=` — campos do CRM que podem alimentar uma
 * variável de template, da entidade e dos vínculos dela.
 *
 * Falha do Bitrix chega como `BitrixError` e o `handle` base responde com o erro do
 * terceiro: o diálogo precisa distinguir "não carregou" de "não tem campos".
 */
export class ListCrmFieldsController extends Controller {
  constructor(private readonly useCase: ListCrmFieldsUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const { entityTypeId } = querySchema.parse(req.query)
    const fields = await this.useCase.execute({ entityTypeId })
    return this.ok({ fields })
  }
}

/**
 * `GET /thinkzap/crm-entity-types` — Lead, Negócio, Contato, Empresa e as SPAs do
 * portal, para o seletor de tipo do diálogo de variáveis padrão.
 */
export class ListCrmEntityTypesController extends Controller {
  constructor(private readonly useCase: ListCrmEntityTypesUseCase) {
    super()
  }

  async perform(): Promise<httpResponse> {
    return this.ok({ entityTypes: await this.useCase.execute() })
  }
}
