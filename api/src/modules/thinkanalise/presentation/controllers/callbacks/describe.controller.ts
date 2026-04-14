import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'

type DescribeBody = {
  name: string
  connection: {
    integration: string
    api_key: string
  }
}

type FieldEntry = { code: string; name: string; type: string }

const schemaByTable: Record<string, FieldEntry[]> = {
  // Asaas
  charges: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'ID do Cliente', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'dueDate', name: 'Vencimento', type: 'date' },
    { code: 'paymentDate', name: 'Data de Pagamento', type: 'date' },
  ],
  customers: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'name', name: 'Nome', type: 'string' },
    { code: 'email', name: 'E-mail', type: 'string' },
    { code: 'cpfCnpj', name: 'CPF/CNPJ', type: 'string' },
    { code: 'dateCreated', name: 'Data de Cadastro', type: 'datetime' },
  ],
  subscriptions: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'ID do Cliente', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'nextDueDate', name: 'Próximo Vencimento', type: 'date' },
  ],
  payments: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'paymentDate', name: 'Data de Pagamento', type: 'date' },
  ],
  // Conta Azul
  invoices: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'number', name: 'Número', type: 'string' },
    { code: 'total', name: 'Total', type: 'double' },
    { code: 'issuedAt', name: 'Data de Emissão', type: 'datetime' },
  ],
  products: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'name', name: 'Nome', type: 'string' },
    { code: 'price', name: 'Preço', type: 'double' },
  ],
  // Omie
  orders: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'Cliente', type: 'string' },
    { code: 'total', name: 'Total', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'createdAt', name: 'Data de Criação', type: 'datetime' },
  ],
}

export class DescribeController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { name } = req.body as DescribeBody

    if (!name) {
      return Promise.resolve(this.badRequest(new Error('Missing table name')))
    }

    const fields = schemaByTable[name] ?? []
    return Promise.resolve(this.ok(fields))
  }
}
