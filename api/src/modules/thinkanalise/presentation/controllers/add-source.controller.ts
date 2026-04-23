import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'

const addSourceSchema = z.object({
  title: z.string().min(1),
  settings: z.record(z.string(), z.string()),
  active: z.boolean().default(true),
})

export class AddSourceController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const connectorId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.connectorId)
    const { title, settings, active } = addSourceSchema.parse(req.body)

    const result = await this.bitrix.sourceAdd({
      connectorId,
      title,
      settings,
      active,
    })

    return this.ok(result)
  }
}
