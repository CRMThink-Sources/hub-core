import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'

import { SyncConnectorTemplatesUseCase } from '@/modules/thinkzap/application/sync-connector-templates'
import { handleTemplateError } from './list-templates.controller'
import { parseLineRequest } from '../line/line-request'

/** `POST /thinkzap/lines/:itemId/templates/sync` — sincroniza status com a Meta. */
export class SyncTemplatesController extends Controller {
  constructor(private readonly useCase: SyncConnectorTemplatesUseCase) {
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
