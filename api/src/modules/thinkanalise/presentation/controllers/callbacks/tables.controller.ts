import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { tables as asaasTables } from './schemas/asaas'
import { tables as contaAzulTables } from './schemas/conta-azul'
import { tables as omieTables } from './schemas/omie'
import { tables as sonaxTables } from './schemas/sonax'

type TablesBody = {
  searchString?: string
  connection: {
    integration: string
    api_key: string
  }
}

const tablesByProvider: Record<string, { code: string; title: string }[]> = {
  asaas: asaasTables,
  conta_azul: contaAzulTables,
  omie: omieTables,
  sonax: sonaxTables,
}

export class TablesController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { connection, searchString } = req.body as TablesBody

    if (!connection?.integration) {
      return Promise.resolve(this.badRequest(new Error('Missing integration')))
    }

    const tables = tablesByProvider[connection.integration] ?? []

    const filtered = searchString
      ? tables.filter(t =>
          t.title.toLowerCase().includes(searchString.toLowerCase()),
        )
      : tables

    return Promise.resolve(this.ok(filtered))
  }
}
