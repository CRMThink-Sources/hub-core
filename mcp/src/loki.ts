// Cliente Loki enxuto do MCP (porta reduzida de api/src/shared/infra/loki-query.service).
// O MCP é pacote separado (deploy próprio) → não importa o api; duplica o mínimo.
// LogQL NUNCA é exposto ao suporte: entra query, sai timeline normalizada.

const LOKI_URL = process.env.LOKI_QUERY_URL?.replace(/\/$/, '')
// Header Authorization completo (ex: "Basic xx=="), service account Viewer read-only.
const LOKI_AUTH = process.env.LOKI_AUTH

export function lokiConfigured(): boolean {
  return Boolean(LOKI_URL)
}

// Limites de consulta: input do suporte não pode disparar query gigante no Loki.
const MAX_SINCE_HOURS = 168 // 7 dias
const MAX_LIMIT = 1000

function clamp(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback
  return Math.min(Math.floor(value as number), max)
}

const PINO_LEVELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
}

export type LogEntry = {
  ts: number // epoch ms
  level: string
  msg: string
  errorCode?: string
  category?: string
  remediation?: string
  retriable?: boolean
  domain?: string
  appId?: string
  app?: string
  traceKey?: string
  count?: number // via C agregada
}

// Escaping estilo Go (aspas duplas do LogQL).
function escapeLogQL(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function parseLine(nsTs: string, line: string): LogEntry {
  const ts = Math.floor(Number(nsTs) / 1e6)
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(line) as Record<string, unknown>
  } catch {
    return { ts, level: 'info', msg: line }
  }
  const levelNum = typeof raw.level === 'number' ? raw.level : undefined
  const level =
    (levelNum !== undefined ? PINO_LEVELS[levelNum] : undefined) ??
    str(raw.level) ??
    'info'
  return {
    ts,
    level,
    msg: str(raw.msg) ?? '',
    errorCode: str(raw.errorCode),
    category: str(raw.category),
    remediation: str(raw.remediation),
    retriable: typeof raw.retriable === 'boolean' ? raw.retriable : undefined,
    domain: str(raw.domain),
    appId: str(raw.appId),
    app: str(raw.app),
    traceKey: str(raw.traceKey),
    count: typeof raw.count === 'number' ? raw.count : undefined,
  }
}

type LokiRange = {
  data?: { result?: Array<{ values: Array<[string, string]> }> }
}

async function runQuery(
  query: string,
  startMs: number,
  endMs: number,
  limit: number,
): Promise<LogEntry[]> {
  if (!LOKI_URL) throw new Error('LOKI_QUERY_URL não configurado')
  const params = new URLSearchParams({
    query,
    start: `${startMs}000000`,
    end: `${endMs}000000`,
    limit: String(limit),
    direction: 'backward',
  })
  const res = await fetch(`${LOKI_URL}/loki/api/v1/query_range?${params}`, {
    headers: LOKI_AUTH ? { Authorization: LOKI_AUTH } : {},
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    throw new Error(`Loki respondeu ${res.status}`)
  }
  const data = (await res.json()) as LokiRange
  const streams = data.data?.result ?? []
  const entries = streams.flatMap(s =>
    s.values.map(([nsTs, line]) => parseLine(nsTs, line)),
  )
  entries.sort((a, b) => b.ts - a.ts)
  return entries.slice(0, limit)
}

// Seletor de stream amplo: `service` é label em toda linha (api + worker), então
// não exige `domain` (que some quando o erro estoura antes de resolver o tenant).
const ALL_STREAMS = '{service=~"hubthink-.+"}'
const EXCLUDE_ACCESS = '!= "HTTP request completed"'

/**
 * Timeline de um traceKey nos dois entry points (HTTP + worker). Se `domain` vier
 * (sessão não-admin), filtra por ele — isolamento por tenant, ao custo de esconder
 * linhas pré-tenant sem domain. Admin passa sem domain e vê tudo. Retorna ascendente.
 */
export async function queryByTrace(
  traceKey: string,
  domain?: string,
  sinceHours?: number,
  limit?: number,
): Promise<LogEntry[]> {
  const hours = clamp(sinceHours, 72, MAX_SINCE_HOURS)
  const cap = clamp(limit, 200, MAX_LIMIT)
  const endMs = Date.now()
  const startMs = endMs - hours * 60 * 60 * 1000
  const domainFilter = domain ? ` | domain="${escapeLogQL(domain)}"` : ''
  const query = `${ALL_STREAMS} ${EXCLUDE_ACCESS} | json | traceKey="${escapeLogQL(traceKey)}"${domainFilter}`
  const entries = await runQuery(query, startMs, endMs, cap)
  return entries.sort((a, b) => a.ts - b.ts) // cronológico pra leitura
}

export type ErrorQuery = {
  // Domínio da sessão (não-admin). Ausente = sessão admin, sem filtro de tenant.
  domain?: string
  errorCode?: string
  app?: string
  sinceHours?: number
  limit?: number
}

/**
 * Linhas classificadas (com errorCode) no período, estreitadas por errorCode / app
 * e, quando a sessão é não-admin, pelo `domain` (isolamento por tenant). Admin não
 * passa domain e vê todos. Sem errorCode → traz qualquer linha classificada.
 */
export async function queryErrors(q: ErrorQuery): Promise<LogEntry[]> {
  const hours = clamp(q.sinceHours, 24, MAX_SINCE_HOURS)
  const limit = clamp(q.limit, 500, MAX_LIMIT)
  const endMs = Date.now()
  const startMs = endMs - hours * 60 * 60 * 1000

  const stream = q.app ? `{app="${escapeLogQL(q.app)}"}` : ALL_STREAMS
  const filters = [
    q.errorCode
      ? `| errorCode="${escapeLogQL(q.errorCode)}"`
      : `| errorCode=~".+"`,
    q.domain ? `| domain="${escapeLogQL(q.domain)}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const query = `${stream} ${EXCLUDE_ACCESS} | json ${filters}`
  return runQuery(query, startMs, endMs, limit)
}
