import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { toDatasetFieldName } from '@/modules/thinkanalise/domain/utils/field-name'
import { apiLogger } from '@/shared/infra/logger'

const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  externalCode: z.string().min(1),
  visible: z.boolean().default(true),
})

const syncFieldsSchema = z.object({
  fields: z.array(fieldSchema).min(1),
})

export class SyncDatasetFieldsController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const { fields } = syncFieldsSchema.parse(req.body)

    const normalized = fields.map(f => ({
      ...f,
      name: toDatasetFieldName(f.name),
    }))

    const result = await this.bitrix.datasetFieldsUpdate(id, normalized)

    apiLogger.info(
      { app: 'thinkanalise', datasetId: id, campos: normalized.length },
      'Campos do dataset sincronizados',
    )

    return this.ok(result)
  }
}
