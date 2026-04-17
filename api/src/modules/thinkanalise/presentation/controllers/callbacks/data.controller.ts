import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { AsaasClient } from '@/shared/infra/clients/asaas.client'
import { AsaasDataService } from '@/modules/thinkanalise/infra/asaas-data.service'

type DataBody = {
  table: string
  select: string[]
  filter?: Record<string, unknown>
  limit?: number | string
  mapFields?: Record<string, string> // externalCode → fieldName
  connection: {
    integration: string
    api_key: string
  }
}

const DATA_SERVICES: Record<string, (apiKey: string) => AsaasDataService> = {
  asaas: apiKey => new AsaasDataService(new AsaasClient(apiKey)),
}

export class DataController extends CallbackController {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { table, select, limit, mapFields, filter, connection } =
      req.body as DataBody

    if (!table || !connection?.api_key || !connection?.integration) {
      return this.badRequest(new Error('Missing required parameters'))
    }

    const makeService = DATA_SERVICES[connection.integration]
    if (!makeService) {
      return this.badRequest(
        new Error(`Provider '${connection.integration}' not implemented`),
      )
    }

    const maxRows = Number(limit) || 1000

    const service = makeService(connection.api_key)
    const data = await service.fetch(
      table,
      select ?? [],
      mapFields ?? {},
      maxRows,
      filter ?? {},
    )

    return this.ok(data)
  }
}
