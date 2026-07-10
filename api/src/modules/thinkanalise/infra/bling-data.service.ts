import { BlingClient } from '@/shared/infra/clients/bling.client'
import { getByPath } from '../domain/utils/get-by-path'

type Row = Record<string, unknown>

type TableConfig = {
  path: string
  // code do schema → params Bling de range de data daquele endpoint
  dateFilters?: Record<string, { de: string; ate: string }>
  fixedParams?: Record<string, unknown>
  // tabelas que não são um GET paginado simples (ex.: situações agregam vários endpoints)
  fetchRows?: (client: BlingClient, maxRows: number) => Promise<Row[]>
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Bling não tem "listar todas situações": N+1 sobre GET /situacoes/modulos/{id}.
// Conjuntos pequenos, não paginam → get direto.
async function fetchSituacoes(
  client: BlingClient,
  maxRows: number,
): Promise<Row[]> {
  const modulosBody = await client.get<{ data?: Row[] }>('/situacoes/modulos')
  const modulos = modulosBody.data ?? []
  const rows: Row[] = []

  // Sequencial com pausa — rate limit de 3 req/s por conta Bling
  for (const modulo of modulos) {
    if (rows.length >= maxRows) break
    await sleep(350)
    const body = await client.get<{ data?: Row[] }>(
      `/situacoes/modulos/${String(modulo.id)}`,
    )
    rows.push(
      ...(body.data ?? []).map(situacao => ({
        ...situacao,
        modulo: { id: modulo.id, nome: modulo.nome ?? modulo.descricao },
      })),
    )
  }

  return rows.slice(0, maxRows)
}

// ⚠️ nomes de filtro a validar no Swagger — ver tasks/thinkanalise/bling.md
const TABLE_CONFIG: Record<string, TableConfig> = {
  contas_pagar: {
    path: '/contas/pagar',
    dateFilters: {
      dataEmissao: { de: 'dataEmissaoInicial', ate: 'dataEmissaoFinal' },
      vencimento: { de: 'dataVencimentoInicial', ate: 'dataVencimentoFinal' },
      dataPagamento: { de: 'dataPagamentoInicial', ate: 'dataPagamentoFinal' },
    },
  },
  contas_receber: {
    path: '/contas/receber',
    // ⚠️ validar se recebimento usa dataPagamento* ou dataRecebimento*
    dateFilters: {
      dataEmissao: { de: 'dataEmissaoInicial', ate: 'dataEmissaoFinal' },
      vencimento: { de: 'dataVencimentoInicial', ate: 'dataVencimentoFinal' },
    },
  },
  categorias_receitas_despesas: { path: '/categorias/receitas-despesas' },
  formas_pagamento: { path: '/formas-pagamentos' },
  pedidos_venda: {
    path: '/pedidos/vendas',
    dateFilters: {
      data: { de: 'dataInicial', ate: 'dataFinal' },
      dataPrevista: { de: 'dataPrevistaInicial', ate: 'dataPrevistaFinal' },
    },
  },
  pedidos_compra: {
    path: '/pedidos/compras',
    // ⚠️ validar semântica de dataInicial/dataFinal (emissão?)
    dateFilters: {
      data: { de: 'dataInicial', ate: 'dataFinal' },
    },
  },
  nfe_emitidas: {
    path: '/nfe',
    dateFilters: {
      dataEmissao: { de: 'dataEmissaoInicial', ate: 'dataEmissaoFinal' },
    },
  },
  situacoes: { path: '/situacoes/modulos', fetchRows: fetchSituacoes },
  contatos: { path: '/contatos' },
  produtos: { path: '/produtos' },
  vendedores: { path: '/vendedores' },
  categorias_produtos: { path: '/categorias/produtos' },
}

// Filtro Bitrix "dd/mm/aaaa hh:mm:ss" → Bling ISO "aaaa-mm-dd"
function toBlingDate(value: string): string | null {
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return iso?.[1] ?? null
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// Bling responde HTTP 400 para range de data > 1 ano — clampa a data inicial
function clampDateRange(
  params: Record<string, unknown>,
  range: { de: string; ate: string },
): void {
  const de = params[range.de]
  if (typeof de !== 'string') return

  const ate =
    typeof params[range.ate] === 'string'
      ? (params[range.ate] as string)
      : isoToday()

  const min = new Date(`${ate}T00:00:00Z`)
  min.setUTCFullYear(min.getUTCFullYear() - 1)
  const minIso = min.toISOString().slice(0, 10)

  if (de < minIso) {
    params[range.de] = minIso
    params[range.ate] = ate
  }
}

export class BlingDataService {
  constructor(private readonly client: BlingClient) {}

  async fetch(
    table: string,
    select: string[],
    mapFields: Record<string, string>, // externalCode → fieldName (Bitrix)
    maxRows = 1000,
    filter: Record<string, unknown> = {},
  ): Promise<unknown[][]> {
    const config = TABLE_CONFIG[table]
    if (!config) return [select]

    // Inverte mapFields: fieldName (Bitrix) → externalCode (dot-path Bling)
    const nameToCode: Record<string, string> = {}
    for (const [code, fieldName] of Object.entries(mapFields)) {
      nameToCode[fieldName] = code
    }

    let rows: Row[]

    if (config.fetchRows) {
      rows = await config.fetchRows(this.client, maxRows)
    } else {
      const params: Record<string, unknown> = { ...config.fixedParams }

      // Formato Bitrix: { ">=DATA_EMISSAO": "01/03/2026 00:00:00" }
      for (const [bitrixKey, value] of Object.entries(filter)) {
        const opMatch = bitrixKey.match(/^(>=|<=|>|<|!=|=?)(.+)$/)
        if (!opMatch) continue

        const operator = opMatch[1] || '='
        const fieldName = opMatch[2]
        if (!fieldName) continue

        const code = nameToCode[fieldName] ?? fieldName
        const range = config.dateFilters?.[code]
        if (!range) continue // filtro sem equivalente Bling nessa tabela — ignora

        const date = toBlingDate(String(value))
        if (!date) continue

        if (operator === '>=' || operator === '>') {
          params[range.de] = date
        } else if (operator === '<=' || operator === '<') {
          params[range.ate] = date
        } else if (operator === '=') {
          params[range.de] = date
          params[range.ate] = date
        }
      }

      for (const range of Object.values(config.dateFilters ?? {})) {
        clampDateRange(params, range)
      }

      rows = await this.client.list<Row>(config.path, params, maxRows)
    }

    // resposta do Bling já vem com datas ISO — sem conversão de saída
    return [
      select,
      ...rows.map(row =>
        select.map(fieldName => {
          const code = nameToCode[fieldName] ?? fieldName
          return getByPath(row, code)
        }),
      ),
    ]
  }
}
