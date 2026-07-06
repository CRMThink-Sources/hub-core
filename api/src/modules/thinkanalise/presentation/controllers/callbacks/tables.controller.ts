import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { listOmieTables } from '@/modules/thinkanalise/infra/omie-capabilities'
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
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { connection, searchString } = req.body as TablesBody

    if (!connection?.integration) {
      return this.badRequest(new Error('Missing integration'))
    }

    let tables: { code: string; title: string }[]

    if (connection.integration === 'omie' && connection.api_key) {
      // Tabelas de estoque/compras dependem do plano — probe com cache decide o que expor
      tables = await listOmieTables(connection.api_key).catch(
        () => omieTables, // probe falhou → lista completa; /data devolve só header p/ módulo off
      )
    } else {
      tables = tablesByProvider[connection.integration] ?? []
    }

    const filtered = searchString
      ? tables.filter(t =>
          t.title.toLowerCase().includes(searchString.toLowerCase()),
        )
      : tables

    return this.ok(filtered)
  }
}
