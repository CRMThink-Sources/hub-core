import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { apiLogger } from '@/shared/infra/logger'
import axios from 'axios'

export class DeleteDatasetController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    try {
      const result = await this.bitrix.datasetDelete(id)
      apiLogger.info({ app: 'thinkanalise', id, result }, 'Dataset deletado')
      return this.ok(result)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        apiLogger.error(
          { app: 'thinkanalise', id, err: err.response?.data },
          'datasetDelete falhou no Bitrix',
        )
      }
      throw err
    }
  }
}
