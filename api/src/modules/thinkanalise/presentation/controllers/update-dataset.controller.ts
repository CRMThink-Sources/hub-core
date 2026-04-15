import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { toDatasetName } from '@/modules/thinkanalise/domain/utils/field-name'

const updateDatasetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

export class UpdateDatasetController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const { name, description } = updateDatasetSchema.parse(req.body)
    const result = await this.bitrix.datasetUpdate(id, {
      ...(name !== undefined && { name: toDatasetName(name) }),
      ...(description !== undefined && { description }),
    })
    return this.ok(result)
  }
}
