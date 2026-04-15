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
  // ── Asaas ────────────────────────────────────────────────────────────────
  charges: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'ID do Cliente', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'netValue', name: 'Valor Líquido', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'billingType', name: 'Forma de Pagamento', type: 'string' },
    { code: 'description', name: 'Descrição', type: 'string' },
    { code: 'externalReference', name: 'Referência Externa', type: 'string' },
    { code: 'dueDate', name: 'Vencimento', type: 'date' },
    { code: 'originalDueDate', name: 'Vencimento Original', type: 'date' },
    { code: 'paymentDate', name: 'Data de Pagamento', type: 'date' },
    { code: 'clientPaymentDate', name: 'Pagamento pelo Cliente', type: 'date' },
    { code: 'confirmedDate', name: 'Data de Confirmação', type: 'date' },
    { code: 'creditDate', name: 'Data de Crédito', type: 'date' },
    { code: 'invoiceNumber', name: 'Nº da Fatura', type: 'string' },
    { code: 'invoiceUrl', name: 'URL da Fatura', type: 'string' },
    { code: 'bankSlipUrl', name: 'URL do Boleto', type: 'string' },
    { code: 'subscription', name: 'ID da Assinatura', type: 'string' },
    { code: 'installmentNumber', name: 'Nº da Parcela', type: 'double' },
    { code: 'anticipated', name: 'Antecipado', type: 'string' },
    { code: 'dateCreated', name: 'Data de Criação', type: 'date' },
  ],

  payments: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'ID do Cliente', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'netValue', name: 'Valor Líquido', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'billingType', name: 'Forma de Pagamento', type: 'string' },
    { code: 'description', name: 'Descrição', type: 'string' },
    { code: 'externalReference', name: 'Referência Externa', type: 'string' },
    { code: 'dueDate', name: 'Vencimento', type: 'date' },
    { code: 'paymentDate', name: 'Data de Pagamento', type: 'date' },
    { code: 'confirmedDate', name: 'Data de Confirmação', type: 'date' },
    { code: 'creditDate', name: 'Data de Crédito', type: 'date' },
    { code: 'subscription', name: 'ID da Assinatura', type: 'string' },
    { code: 'dateCreated', name: 'Data de Criação', type: 'date' },
  ],

  customers: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'name', name: 'Nome', type: 'string' },
    { code: 'email', name: 'E-mail', type: 'string' },
    { code: 'phone', name: 'Telefone', type: 'string' },
    { code: 'mobilePhone', name: 'Celular', type: 'string' },
    { code: 'cpfCnpj', name: 'CPF/CNPJ', type: 'string' },
    { code: 'personType', name: 'Tipo de Pessoa', type: 'string' },
    { code: 'address', name: 'Endereço', type: 'string' },
    { code: 'addressNumber', name: 'Número', type: 'string' },
    { code: 'complement', name: 'Complemento', type: 'string' },
    { code: 'province', name: 'Bairro', type: 'string' },
    { code: 'postalCode', name: 'CEP', type: 'string' },
    { code: 'city', name: 'Cidade', type: 'string' },
    { code: 'state', name: 'Estado', type: 'string' },
    { code: 'externalReference', name: 'Referência Externa', type: 'string' },
    { code: 'observations', name: 'Observações', type: 'string' },
    {
      code: 'notificationDisabled',
      name: 'Notificações Desativadas',
      type: 'string',
    },
    { code: 'dateCreated', name: 'Data de Cadastro', type: 'date' },
  ],

  subscriptions: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'customer', name: 'ID do Cliente', type: 'string' },
    { code: 'value', name: 'Valor', type: 'double' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'billingType', name: 'Forma de Pagamento', type: 'string' },
    { code: 'cycle', name: 'Ciclo', type: 'string' },
    { code: 'description', name: 'Descrição', type: 'string' },
    { code: 'externalReference', name: 'Referência Externa', type: 'string' },
    { code: 'nextDueDate', name: 'Próximo Vencimento', type: 'date' },
    { code: 'endDate', name: 'Data de Encerramento', type: 'date' },
    { code: 'dateCreated', name: 'Data de Criação', type: 'date' },
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
