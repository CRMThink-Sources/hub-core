import { SonaxClient } from '@/shared/infra/clients/sonax.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkanaliseError } from '../errors/catalog'

const CHAMADAS_COLS = [
  'PROTOCOLO',
  'ID_CLIENTE',
  'NUMERO',
  'ATENDIDO',
  'DATA_INICIO',
  'DATA_FIM',
  'DURACAO',
  'TENTATIVAS',
  'TABULACAO',
  'ID_TABULACAO',
  'TIPO_TABULACAO',
  'LOGIN_AGENTE',
  'OBSERVACAO',
] as const

const TABLE_CONFIG: Record<
  string,
  { acao: string; separator: 'pipe' | 'csv'; columns: readonly string[] }
> = {
  chamadas: {
    acao: 'download_arquivo_contato',
    separator: 'pipe',
    columns: CHAMADAS_COLS,
  },
  campanhas: {
    acao: 'lista_campanha',
    separator: 'pipe',
    columns: [
      'ID_CAMPANHA',
      'DESCRICAO_CAMPANHA',
      'DATA_CRIACAO',
      'ID_FILA',
      'QTD_CONTATOS',
      'STATUS_CAMPANHA',
      'QTD_SIMULTANEAS_PA',
      'QTD_REPROCESSAMENTOS',
    ],
  },
  filas: {
    acao: 'lista_filas',
    separator: 'pipe',
    columns: ['ID_FILA', 'DESCRICAO'],
  },
  tabulacoes: {
    acao: 'lista_tabulacao',
    separator: 'pipe',
    columns: ['ID_TABULACAO', 'DESCRICAO', 'TIPO'],
  },
  pausas: {
    acao: 'lista_pausas',
    separator: 'pipe',
    columns: ['ID_PAUSA', 'DESCRICAO', 'TIPO_PAUSA'],
  },
}

function parseBitrixDate(value: string): Date | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/)
  if (!m) return null
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00:00:00'}`)
}

function extractDateRange(
  filter: Record<string, unknown>,
  field: string,
): { from?: Date; to?: Date } {
  const result: { from?: Date; to?: Date } = {}
  for (const [key, val] of Object.entries(filter)) {
    const m = key.match(/^(>=|<=)(.+)$/)
    if (!m || m[2] !== field) continue
    const d = parseBitrixDate(String(val))
    if (!d) continue
    if (m[1] === '>=') result.from = d
    else result.to = d
  }
  return result
}

export class SonaxDataService {
  constructor(private readonly client: SonaxClient) {}

  async fetch(
    table: string,
    select: string[],
    mapFields: Record<string, string>,
    maxRows: number,
    filter: Record<string, unknown>,
  ): Promise<unknown[][]> {
    const config = TABLE_CONFIG[table]
    if (!config) return [select]

    // Inverte mapFields: bitrixFieldName → externalCode (coluna Sonax)
    const nameToCode: Record<string, string> = {}
    for (const [code, name] of Object.entries(mapFields)) {
      nameToCode[name] = code
    }

    let rows: string[][]

    if (table === 'chamadas') {
      rows = await this.fetchChamadas(filter, maxRows)
    } else {
      const params: Record<string, string> =
        table === 'campanhas' ? { id_campanha: 'todas' } : {}
      const raw = await this.client.request(config.acao, params)
      rows = this.client.parsePipe(raw)
    }

    const { columns } = config

    return [
      select,
      ...rows.slice(0, maxRows).map(row =>
        select.map(fieldName => {
          const code = nameToCode[fieldName] ?? fieldName
          const idx = columns.indexOf(code)
          return idx >= 0 ? (row[idx] ?? null) : null
        }),
      ),
    ]
  }

  private async fetchChamadas(
    filter: Record<string, unknown>,
    maxRows: number,
  ): Promise<string[][]> {
    const dateRange = extractDateRange(filter, 'DATA_INICIO')
    const DATA_INICIO_IDX = CHAMADAS_COLS.indexOf('DATA_INICIO')

    let campaignRaw: string
    try {
      campaignRaw = await this.client.request('lista_campanha', {
        id_campanha: 'todas',
      })
    } catch (error) {
      logThinkanaliseError(
        apiLogger,
        'thinkanalise.sonax.campaigns_unavailable',
        {
          err: error instanceof Error ? error.message : String(error),
        },
      )
      return []
    }

    const campaigns = this.client.parsePipe(campaignRaw)
    const campaignIds = campaigns
      .map(r => r[0])
      .filter((id): id is string => Boolean(id))

    const all: string[][] = []

    for (const id of campaignIds) {
      if (all.length >= maxRows) break

      let raw: string
      try {
        raw = await this.client.request('download_arquivo_contato', {
          id_campanha: id,
        })
      } catch (error) {
        // Campanha sem dados ou erro transitório — pula pra próxima (via C).
        logThinkanaliseError(apiLogger, 'thinkanalise.sonax.campaign_skipped', {
          id_campanha: id,
          err: error instanceof Error ? error.message : String(error),
        })
        continue
      }

      const rows = this.client.parsePipe(raw)

      for (const row of rows) {
        if (dateRange.from !== undefined || dateRange.to !== undefined) {
          const dataStr = row[DATA_INICIO_IDX]
          if (!dataStr) continue
          const data = new Date(dataStr)
          if (dateRange.from && data < dateRange.from) continue
          if (dateRange.to && data > dateRange.to) continue
        }
        all.push(row)
        if (all.length >= maxRows) break
      }
    }

    return all
  }
}
