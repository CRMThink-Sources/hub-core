import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { ListConnectorTemplatesUseCase } from '@/modules/thinkzap/application/list-connector-templates'
import { ConnectorNotFoundError } from '@/modules/thinkzap/application/helpers/resolve-template-context'
import {
  ConnectorNotTemplateCapableError,
  TemplatesNotSupportedError,
} from '@/modules/thinkzap/domain/ports/template-errors'

/** `GET /thinkzap/connector/:id/templates` — lista templates do conector. */
export class ListTemplatesController extends Controller {
  constructor(private readonly useCase: ListConnectorTemplatesUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({ id: z.string().min(1) })
      .safeParse(req.params)
    if (!params.success) {
      return this.badRequest(new Error('Invalid request: connector id ausente'))
    }

    try {
      const templates = await this.useCase.execute(params.data.id)
      return this.ok({ templates })
    } catch (error) {
      return handleTemplateError.call(this, error)
    }
  }
}

/**
 * Traduz erros de domínio de templates para respostas HTTP. Compartilhado pelos
 * controllers de template para não repetir o mapeamento.
 */
export function handleTemplateError(
  this: Controller,
  error: unknown,
): httpResponse {
  if (error instanceof ConnectorNotFoundError) {
    return this.notFound(error)
  }
  if (
    error instanceof ConnectorNotTemplateCapableError ||
    error instanceof TemplatesNotSupportedError
  ) {
    return this.badRequest(error)
  }
  throw error
}
