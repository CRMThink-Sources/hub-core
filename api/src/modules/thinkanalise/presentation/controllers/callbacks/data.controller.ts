import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'

type DataBody = {
  table: string
  select: string[]
  filter?: Record<string, unknown>
  limit?: number
  connection: {
    integration: string
    api_key: string
  }
}

export class DataController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { table, select, connection } = req.body as DataBody

    if (!table || !connection?.api_key || !connection?.integration) {
      return Promise.resolve(
        this.badRequest(new Error('Missing required parameters')),
      )
    }

    // TODO: buscar dados reais do provider (connection.integration) usando connection.api_key
    // O retorno deve ser array de arrays: primeira linha = cabeçalhos, demais = dados
    const headers = select?.length ? select : ['id']
    return Promise.resolve(this.ok([headers]))
  }
}
