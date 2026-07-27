import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { SyncConnectorTemplatesUseCase } from '@/modules/thinkzap/application/sync-connector-templates'
import { handleTemplateError } from './list-templates.controller'

/** `POST /thinkzap/connector/:id/templates/sync` — sincroniza status com a Meta. */
export class SyncTemplatesController extends Controller {
  constructor(private readonly useCase: SyncConnectorTemplatesUseCase) {
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
