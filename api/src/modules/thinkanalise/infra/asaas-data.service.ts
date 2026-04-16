import { AsaasClient } from '@/shared/infra/clients/asaas.client'

const TABLE_PATH: Record<string, string> = {
  charges: '/payments',
  payments: '/payments',
  customers: '/customers',
  subscriptions: '/subscriptions',
}

// Operadores do Bitrix → sufixo da API Asaas
const OPERATOR_MAP: Record<string, string> = {
  '>=': '[ge]',
  '<=': '[le]',
  '>': '[gt]',
  '<': '[lt]',
  '=': '',
  '!=': '[ne]',
}

// Converte "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY" para "YYYY-MM-DD"
function parseBitrixDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return value
}

export class AsaasDataService {
  constructor(private readonly client: AsaasClient) {}

  async fetch(
    table: string,
    select: string[],
    mapFields: Record<string, string>, // externalCode → fieldName (Bitrix)
    maxRows = 1000,
    filter: Record<string, unknown> = {},
  ): Promise<unknown[][]> {
    const path = TABLE_PATH[table]

    if (!path) {
      return [select]
    }

    // Inverte mapFields: fieldName (Bitrix) → externalCode (chave da API Asaas)
    const nameToKey: Record<string, string> = {}
    for (const [apiKey, fieldName] of Object.entries(mapFields)) {
      nameToKey[fieldName] = apiKey
    }

    // Traduz filtros do Bitrix para parâmetros da API Asaas
    // Formato Bitrix: { ">=VENCIMENTO": "01/03/2026 00:00:00" }
    const dynamicParams: Record<string, unknown> = {}
    for (const [bitrixKey, value] of Object.entries(filter)) {
      const opMatch = bitrixKey.match(/^(>=|<=|>|<|!=|=?)(.+)$/)
      if (!opMatch) continue

      const operator = opMatch[1] || '='
      const fieldName = opMatch[2]
      if (!fieldName) continue

      const asaasField: string | undefined = nameToKey[fieldName] // ex: "dueDate"

      if (!asaasField) continue

      const suffix = OPERATOR_MAP[operator] ?? ''
      const param = `${asaasField}${suffix}` // ex: "dueDate[ge]"

      const strValue = String(value)
      dynamicParams[param] = strValue.match(/^\d{2}\/\d{2}\/\d{4}/)
        ? parseBitrixDate(strValue)
        : strValue
    }

    const params = { ...dynamicParams }

    const rows = await this.client.list<Record<string, unknown>>(
      path,
      params,
      maxRows,
    )

    return [
      select,
      ...rows.map(row =>
        select.map(fieldName => {
          const apiKey = nameToKey[fieldName] ?? fieldName
          return row[apiKey] ?? null
        }),
      ),
    ]
  }
}
