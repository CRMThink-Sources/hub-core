import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import {
  toDatasetFieldName,
  toDatasetName,
} from '@/modules/thinkanalise/domain/utils/field-name'

const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'double', 'date', 'datetime']),
  externalCode: z.string().min(1),
  visible: z.boolean().default(true),
})

const addDatasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  externalCode: z.string().min(1),
  externalName: z.string().min(1),
  fields: z.array(fieldSchema).min(1),
})

export class AddDatasetController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const sourceId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.sourceId)
    const body = addDatasetSchema.parse(req.body)

    const fields = body.fields.map(f => ({
      ...f,
      name: toDatasetFieldName(f.name),
    }))

    const payload = {
      sourceId,
      name: `thinkhub_${toDatasetName(body.name)}`,
      description: body.description,
      externalCode: body.externalCode,
      externalName: `[ThinkHub] ${body.externalName}`,
      fields,
    }

    const result = await this.bitrix.datasetAdd(payload)

    return this.ok(result)
  }
}
