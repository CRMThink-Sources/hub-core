import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'

export class ListSourcesController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const connectorId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.connectorId)
    const sources = await this.bitrix.sourceList(connectorId)
    return this.ok(sources)
  }
}
