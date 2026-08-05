// Abstração de fonte de logs do MCP. Duas implementações (LokiSource p/ apps do
// hub-core, BetterStackSource p/ produtos HubThink) por trás da mesma interface —
// o router (index.ts) escolhe por produto. Query crua (LogQL/SQL) NUNCA sai daqui.

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
  count?: number // via agregada (Loki)
}

export type ErrorQuery = {
  // Domínio da sessão (não-admin). Ausente = sessão admin, sem filtro de tenant.
  domain?: string
  errorCode?: string
  app?: string
  sinceHours?: number
  limit?: number
}

export interface LogSource {
  readonly name: string
  configured(): boolean
  // Timeline de um traceKey. `domain` presente = filtro de tenant (não-admin).
  queryByTrace(
    traceKey: string,
    domain?: string,
    sinceHours?: number,
    limit?: number,
  ): Promise<LogEntry[]>
  // Linhas classificadas (com errorCode) no período, estreitadas por filtro.
  queryErrors(q: ErrorQuery): Promise<LogEntry[]>
}

// Limites de consulta: input do suporte não pode disparar query gigante.
export const MAX_SINCE_HOURS = 168 // 7 dias
export const MAX_LIMIT = 1000

export function clamp(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback
  return Math.min(Math.floor(value as number), max)
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
