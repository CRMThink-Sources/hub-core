import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'

import { ListConnectorTemplatesUseCase } from '@/modules/thinkzap/application/list-connector-templates'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { mapLineBlockedError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from '../line/line-request'
import {
  ChannelNotConnectedError,
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
  /**
   * Só criar e sincronizar chegam aqui com linha bloqueada — listar não pede
   * habilitação, é leitura. Mesmo `402` das rotas de linha.
   */
  if (error instanceof LineBlockedError) {
    return mapLineBlockedError(error)
  }
  /**
   * `ChannelNotConnectedError` entra aqui com o mesmo `400`: a requisição está certa e
   * o estado da linha é que não permite. A diferença dos outros dois é a mensagem, que
   * diz ao cliente o que fazer — conectar o número — em vez de mandar abrir chamado.
   */
  if (
    error instanceof ConnectorNotTemplateCapableError ||
    error instanceof ChannelNotConnectedError ||
    error instanceof TemplatesNotSupportedError
  ) {
    return this.badRequest(error)
  }
  throw error
}
