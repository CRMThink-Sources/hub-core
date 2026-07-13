import axios from 'axios'
import { env } from '@/config/env'
import type { LogApp } from '@/shared/infra/logger'

export type QueryLogsInput = {
  appLabel: LogApp
  domain: string
  startMs: number
  endMs: number
  limit: number
  search?: string
}

export type LogEntry = {
  ts: number
  level: string
  msg: string
  traceKey?: string
  path?: string
  raw: Record<string, unknown>
}

const PINO_LEVELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
}

// Aspas duplas do LogQL usam escaping estilo Go.
function escapeLogQL(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

export function buildLogQL(input: {
  appLabel: LogApp
  domain: string
  search?: string
}): string {
  // Só `app` como seletor de stream: é label tanto via promtail (prod) quanto
  // via pino-loki (dev). `job="docker"` só existe no caminho do promtail.
  // Exclui o ruído de acesso HTTP (irrelevante pro cliente) antes do parse.
  let query = `{app="${escapeLogQL(input.appLabel)}"} != "HTTP request completed" | json | domain="${escapeLogQL(input.domain)}"`
  const search = input.search?.trim()
  if (search) {
    query += ` |= "${escapeLogQL(search)}"`
  }
  return query
}

type LokiRange = {
  data?: { result?: Array<{ values: Array<[string, string]> }> }
}

function parseLine(nsTs: string, line: string): LogEntry {
  const ts = Math.floor(Number(nsTs) / 1e6)
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(line) as Record<string, unknown>
  } catch {
    return { ts, level: 'info', msg: line, raw: {} }
  }
  const levelNum = typeof raw.level === 'number' ? raw.level : undefined
  const level =
    (levelNum !== undefined ? PINO_LEVELS[levelNum] : undefined) ??
    (typeof raw.level === 'string' ? raw.level : 'info')
  return {
    ts,
    level,
    msg: typeof raw.msg === 'string' ? raw.msg : '',
    traceKey: typeof raw.traceKey === 'string' ? raw.traceKey : undefined,
    path: typeof raw.path === 'string' ? raw.path : undefined,
    raw,
  }
}

export async function queryLogs(input: QueryLogsInput): Promise<LogEntry[]> {
  const { data } = await axios.get<LokiRange>(
    `${env.lokiQueryUrl}/loki/api/v1/query_range`,
    {
      params: {
        query: buildLogQL(input),
        start: `${input.startMs}000000`,
        end: `${input.endMs}000000`,
        limit: input.limit,
        direction: 'backward',
      },
      timeout: 15000,
    },
  )

  const streams = data.data?.result ?? []
  const entries = streams.flatMap(s =>
    s.values.map(([nsTs, line]) => parseLine(nsTs, line)),
  )
  entries.sort((a, b) => b.ts - a.ts)
  return entries.slice(0, input.limit)
}
