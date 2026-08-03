import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'

import { ListConnectorTemplatesUseCase } from '@/modules/thinkzap/application/list-connector-templates'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { parseLineRequest } from '../line/line-request'
import {
  ConnectorNotTemplateCapableError,
  TemplatesNotSupportedError,
} from '@/modules/thinkzap/domain/ports/template-errors'

/** `GET /thinkzap/lines/:itemId/templates` — templates da linha. */
export class ListTemplatesController extends Controller {
  constructor(private readonly useCase: ListConnectorTemplatesUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    try {
      const templates = await this.useCase.execute(parseLineRequest(req))
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
  if (error instanceof LineNotFoundError) {
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
