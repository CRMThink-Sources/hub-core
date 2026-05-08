import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import axios from 'axios'

export class DeleteDatasetController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    try {
      const result = await this.bitrix.datasetDelete(id)
      console.log('[DeleteDataset] id:', id, '| resultado Bitrix:', result)
      return this.ok(result)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(
          '[DeleteDataset] Erro no Bitrix:',
          JSON.stringify(err.response?.data, null, 2),
        )
      }
      throw err
    }
  }
}
