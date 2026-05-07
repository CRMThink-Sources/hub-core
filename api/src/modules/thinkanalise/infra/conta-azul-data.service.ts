import { ContaAzulClient } from '@/shared/infra/clients/conta-azul.client'

const TABLE_PATH: Record<string, string> = {
  customers: '/pessoas',
  sales: '/venda/busca',
  bills_to_receive: '/financeiro/eventos-financeiros/contas-a-receber/buscar',
  products: '/produtos',
}

// Params obrigatórios para endpoints que exigem filtros de data
const TABLE_REQUIRED_PARAMS: Record<string, Record<string, string>> = {
  bills_to_receive: {
    data_vencimento_de: '2000-01-01',
    data_vencimento_ate: '2099-12-31',
  },
}

// Converte "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY" para "YYYY-MM-DD"
function parseBitrixDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return value
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Acessa campos aninhados via dot-notation (ex: "customer.name")
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return null
  }, obj)
}

export class ContaAzulDataService {
  private readonly accountId: string | null

  constructor(
    private client: ContaAzulClient,
    private readonly refreshAccessToken?: () => Promise<string>,
  ) {
    this.accountId = client.accountId
  }

  async fetch(
    table: string,
    select: string[],
    mapFields: Record<string, string>, // externalCode → fieldName (Bitrix)
    maxRows = 1000,
    filter: Record<string, unknown> = {},
  ): Promise<unknown[][]> {
    const path = TABLE_PATH[table]
    if (!path) return [select]

    // Inverte mapFields: fieldName (Bitrix) → externalCode (chave da API)
    const nameToKey: Record<string, string> = {}
    for (const [apiKey, fieldName] of Object.entries(mapFields)) {
      nameToKey[fieldName] = apiKey
    }

    // Traduz filtros do Bitrix para parâmetros da API Conta Azul
    // Bitrix envia: { ">=VENCIMENTO": "01/03/2026 00:00:00" }
    // Conta Azul espera: { startDueDate: "2026-03-01" }
    const params: Record<string, unknown> = {}
    for (const [bitrixKey, value] of Object.entries(filter)) {
      const opMatch = bitrixKey.match(/^(>=|<=|>|<|!=|=?)(.+)$/)
      if (!opMatch) continue

      const operator = opMatch[1] || '='
      const fieldName = opMatch[2]
      if (!fieldName) continue

      const apiField = nameToKey[fieldName]
      if (!apiField) continue

      const strValue = String(value)
      const parsedValue = strValue.match(/^\d{2}\/\d{2}\/\d{4}/)
        ? parseBitrixDate(strValue)
        : strValue

      // Campos aninhados (ex: "customer.id") não são filtráveis diretamente
      const rootField = apiField.split('.')[0] ?? apiField
      const camel = toCamelCase(rootField)

      if (operator === '>=' || operator === '>') {
        params[`start${capitalize(camel)}`] = parsedValue
      } else if (operator === '<=' || operator === '<') {
        params[`end${capitalize(camel)}`] = parsedValue
      } else if (operator === '=' || operator === '') {
        params[rootField] = parsedValue
      }
    }

    const mergedParams = { ...TABLE_REQUIRED_PARAMS[table], ...params }

    let rows: Record<string, unknown>[]
    try {
      rows = await this.client.list<Record<string, unknown>>(
        path,
        mergedParams,
        maxRows,
      )
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status
      if (status === 401 && this.refreshAccessToken) {
        const newToken = await this.refreshAccessToken()
        this.client = new ContaAzulClient(newToken, this.accountId)
        rows = await this.client.list<Record<string, unknown>>(
          path,
          params,
          maxRows,
        )
      } else {
        throw err
      }
    }

    return [
      select,
      ...rows.map(row =>
        select.map(fieldName => {
          const apiKey = nameToKey[fieldName] ?? fieldName
          return getNestedValue(row, apiKey) ?? null
        }),
      ),
    ]
  }
}
