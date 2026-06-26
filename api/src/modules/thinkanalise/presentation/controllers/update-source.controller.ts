import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { apiLogger } from '@/shared/infra/logger'

const updateSourceSchema = z.object({
  title: z.string().min(1).optional(),
  active: z.boolean().optional(),
  settings: z.record(z.string(), z.string()).optional(),
})

export class UpdateSourceController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const fields = updateSourceSchema.parse(req.body)

    const result = await this.bitrix.sourceUpdate(id, fields)

    apiLogger.info({ app: 'thinkanalise', sourceId: id }, 'Fonte atualizada')

    return this.ok(result)
  }
}
