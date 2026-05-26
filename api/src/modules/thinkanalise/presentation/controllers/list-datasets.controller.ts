import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'

export class ListDatasetsController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const sourceId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.sourceId)
    const list = await this.bitrix.datasetList(sourceId)
    const datasets = await Promise.all(
      list.map(async d => {
        const detail = await this.bitrix.datasetGet(d.id)
        return { ...d, fields: detail.fields }
      }),
    )
    return this.ok(datasets)
  }
}
