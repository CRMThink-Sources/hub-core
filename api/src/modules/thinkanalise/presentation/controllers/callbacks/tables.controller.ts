import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'

type TablesBody = {
  searchString?: string
  connection: {
    integration: string
    api_key: string
  }
}

type TableEntry = { code: string; title: string }

const tablesByProvider: Record<string, TableEntry[]> = {
  asaas: [
    { code: 'charges', title: 'Cobranças' },
    { code: 'customers', title: 'Clientes' },
    { code: 'subscriptions', title: 'Assinaturas' },
    { code: 'payments', title: 'Pagamentos' },
  ],
  conta_azul: [
    { code: 'customers', title: 'Clientes' },
    { code: 'invoices', title: 'Notas Fiscais' },
    { code: 'products', title: 'Produtos' },
  ],
  omie: [
    { code: 'customers', title: 'Clientes' },
    { code: 'orders', title: 'Pedidos' },
    { code: 'invoices', title: 'Notas Fiscais' },
  ],
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
