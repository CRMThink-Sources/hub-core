// BetterStackSource: produtos HubThink (emitem via Logtail → BetterStack).
// Consulta pela SQL API (ClickHouse HTTP), read-only, Basic auth. SQL nunca vaza.
// Campos estruturados ficam DENTRO do `raw` (string JSON): extraídos via
// JSONExtractString. Produto = prefixo do errorCode (o campo `app` é sobrecarregado
// no legado com appId numérico, então não serve pra rotear).
import {
  type LogEntry,
  type ErrorQuery,
  type LogSource,
  MAX_SINCE_HOURS,
  MAX_LIMIT,
  clamp,
  str,
} from './source.js'

const SQL_URL = process.env.BETTERSTACK_SQL_URL?.replace(/\/$/, '')
const SQL_USER = process.env.BETTERSTACK_SQL_USER
const SQL_PASSWORD = process.env.BETTERSTACK_SQL_PASSWORD
const SQL_TABLE = process.env.BETTERSTACK_SQL_TABLE // ex: t495123_hubthink_logs

// Literal string SQL seguro: escapa `\` e `'` (breakout de aspas simples). Valores
// vêm do suporte (traceKey/errorCode/app) e do JWT (domain) — sempre escapados.
function q(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, ' ')}'`
}

// Extrai um campo do `raw` JSON no WHERE/SELECT.
function field(name: string): string {
  return `JSONExtractString(raw, ${q(name)})`
}

// Casa uma substring em QUALQUER lugar do `raw` (campo estruturado OU texto do
// message). No legado o traceKey e o domínio vivem dentro do message, não como
// campo — por isso `position` em vez de igualdade de campo.
function contains(value: string): string {
  return `position(raw, ${q(value)}) > 0`
}

// Filtro de tenant: admin (sem domain) não filtra; não-admin casa o domínio no raw
// (estruturado nas linhas instrumentadas, dentro do message no legado).
function domainClause(domain?: string): string {
  return domain ? contains(domain) : ''
}

type Row = { dt?: string; raw?: string }

function parseRow(row: Row): LogEntry {
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(row.raw ?? '{}') as Record<string, unknown>
  } catch {
    // raw ilegível: guarda o texto cru como msg, timestamp da coluna.
    return { ts: colTs(row.dt), level: 'info', msg: row.raw ?? '' }
  }
  // `dt` ISO dentro do raw é o mais confiável; cai pra coluna dt se faltar.
  const isoTs = str(raw.dt)
  const ts = isoTs ? Date.parse(isoTs) : colTs(row.dt)
  return {
    ts: Number.isFinite(ts) ? ts : colTs(row.dt),
    level: str(raw.level) ?? 'info',
    msg: str(raw.message) ?? '',
    errorCode: str(raw.errorCode),
    category: str(raw.category),
    remediation: str(raw.remediation),
    retriable: typeof raw.retriable === 'boolean' ? raw.retriable : undefined,
    domain: str(raw.domain),
    appId: str(raw.appId),
    app: str(raw.app),
    traceKey: str(raw.traceKey),
    // Sem agregação server-side: cada linha conta 1 (fmtErrorAggregation soma).
  }
}

// Coluna dt do ClickHouse ("2026-08-05 17:32:36.670000", UTC) → epoch ms.
function colTs(dt?: string): number {
  if (!dt) return 0
  const ms = Date.parse(
    dt.replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z',
  )
  return Number.isFinite(ms) ? ms : 0
}

async function runSql(sql: string): Promise<LogEntry[]> {
  if (!SQL_URL || !SQL_USER || !SQL_PASSWORD || !SQL_TABLE) {
    throw new Error('BetterStack SQL não configurado')
  }
  const auth = Buffer.from(`${SQL_USER}:${SQL_PASSWORD}`).toString('base64')
  const res = await fetch(`${SQL_URL}/?output_format_pretty_row_numbers=0`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'plain/text',
    },
    body: sql,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    throw new Error(`BetterStack respondeu ${res.status}`)
  }
  const body = await res.text()
  return body
    .split('\n')
    .filter(l => l.trim().length > 0)
    .map(l => parseRow(JSON.parse(l) as Row))
}

// Todo produto HubThink vive nesta tabela; o filtro de tempo protege o custo.
function table(): string {
  return `remote(${SQL_TABLE})`
}

export const betterStackSource: LogSource = {
  name: 'betterstack',

  configured() {
    return Boolean(SQL_URL && SQL_USER && SQL_PASSWORD && SQL_TABLE)
  },

  async queryByTrace(traceKey, domain, sinceHours, limit) {
    const hours = clamp(sinceHours, 72, MAX_SINCE_HOURS)
    const cap = clamp(limit, 200, MAX_LIMIT)
    const where = [
      `dt >= now() - INTERVAL ${hours} HOUR`,
      contains(traceKey), // estruturado ou dentro do message
      domainClause(domain),
    ]
      .filter(Boolean)
      .join(' AND ')
    const sql =
      `SELECT dt, raw FROM ${table()} WHERE ${where} ` +
      `ORDER BY dt DESC LIMIT ${cap} FORMAT JSONEachRow`
    const entries = await runSql(sql)
    return entries.sort((a, b) => a.ts - b.ts) // cronológico pra leitura
  },

  async queryErrors(qy: ErrorQuery) {
    const hours = clamp(qy.sinceHours, 24, MAX_SINCE_HOURS)
    const limit = clamp(qy.limit, 500, MAX_LIMIT)
    const where = [
      `dt >= now() - INTERVAL ${hours} HOUR`,
      qy.errorCode
        ? `${field('errorCode')} = ${q(qy.errorCode)}`
        : `${field('errorCode')} != ''`,
      // Produto = prefixo do errorCode (ex: app "sonax" → "sonax.").
      qy.app ? `startsWith(${field('errorCode')}, ${q(qy.app + '.')})` : '',
      domainClause(qy.domain),
    ]
      .filter(Boolean)
      .join(' AND ')
    const sql =
      `SELECT dt, raw FROM ${table()} WHERE ${where} ` +
      `ORDER BY dt DESC LIMIT ${limit} FORMAT JSONEachRow`
    return runSql(sql)
  },
}

// Id da chamada = só dígitos. Guard antes de injetar no SQL (defense-in-depth).
const SAFE_CALL_ID = /^\d{1,20}$/

// Específico do Sonax: uma chamada gera eventos separados (início/andamento/
// encerramento/áudio), cada um com traceKey próprio, mas o MESMO id de chamada — que
// aparece sob 3 chaves distintas conforme a fase. Junta as fases pelo id p/ ver o
// que aconteceu com a chamada inteira. Não vive na interface LogSource (é do Sonax).
export async function queryBySonaxCall(
  callId: string,
  domain?: string,
  sinceHours?: number,
  limit?: number,
): Promise<LogEntry[]> {
  const id = callId.trim()
  if (!SAFE_CALL_ID.test(id)) return []
  const hours = clamp(sinceHours, 72, MAX_SINCE_HOURS)
  const cap = clamp(limit, 200, MAX_LIMIT)
  // As 3 chaves do id conforme a fase do evento.
  const idMatch =
    `(${field('sonaxCallId')} = ${q(id)}` +
    ` OR toString(JSONExtractInt(raw, 'idChamadaSonax')) = ${q(id)}` +
    ` OR JSONExtractString(JSONExtractRaw(raw, 'DadosRecebidosSonax'), 'id_chamada') = ${q(id)})`
  const where = [
    `dt >= now() - INTERVAL ${hours} HOUR`,
    idMatch,
    domainClause(domain),
  ]
    .filter(Boolean)
    .join(' AND ')
  const sql =
    `SELECT dt, raw FROM ${table()} WHERE ${where} ` +
    `ORDER BY dt DESC LIMIT ${cap} FORMAT JSONEachRow`
  const entries = await runSql(sql)
  return entries.sort((a, b) => a.ts - b.ts) // cronológico p/ leitura
}
