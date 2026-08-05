// Router de logs: escolhe a fonte por produto e agrega. É o único ponto que as
// tools de log chamam — elas não sabem se o dado veio do Loki ou do BetterStack.
import type { LogEntry, ErrorQuery, LogSource } from './source.js'
import { lokiSource } from './loki-source.js'
import {
  betterStackSource,
  queryBySonaxCall as bsQueryBySonaxCall,
} from './betterstack-source.js'

// Produtos que emitem pro BetterStack (HubThink). Todo o resto = Loki (casa).
// Extensível: cada produto HubStack novo com catálogo entra aqui.
const HUBTHINK_APPS = new Set<string>(['sonax'])

function sourceForApp(app: string): LogSource {
  return HUBTHINK_APPS.has(app) ? betterStackSource : lokiSource
}

const ALL_SOURCES: LogSource[] = [lokiSource, betterStackSource]

function configuredSources(): LogSource[] {
  return ALL_SOURCES.filter(s => s.configured())
}

export function logsConfigured(): boolean {
  return configuredSources().length > 0
}

// Fan-out resiliente: roda nas fontes dadas, junta os sucessos. Se TODAS falharem,
// propaga o 1º erro (o suporte vê "falha ao consultar"); falha parcial não derruba
// a consulta (uma fonte fora não esconde o resultado da outra).
async function fanOut(
  sources: LogSource[],
  run: (s: LogSource) => Promise<LogEntry[]>,
): Promise<LogEntry[]> {
  const settled = await Promise.allSettled(sources.map(run))
  const ok = settled.filter(
    (r): r is PromiseFulfilledResult<LogEntry[]> => r.status === 'fulfilled',
  )
  if (ok.length === 0) {
    const firstErr = settled.find(r => r.status === 'rejected')
    throw firstErr?.reason ?? new Error('Nenhuma fonte de logs disponível')
  }
  return ok.flatMap(r => r.value)
}

// traceKey não carrega produto (o suporte copia da tela sem saber o backend) →
// consulta as duas fontes em paralelo; só a dona do fluxo retorna linhas.
export async function queryByTrace(
  traceKey: string,
  domain?: string,
  sinceHours?: number,
  limit?: number,
): Promise<LogEntry[]> {
  const entries = await fanOut(configuredSources(), s =>
    s.queryByTrace(traceKey, domain, sinceHours, limit),
  )
  return entries.sort((a, b) => a.ts - b.ts) // cronológico p/ leitura
}

// Com produto conhecido, rota direta pra fonte dona; sem produto, fan-out nas duas.
export async function queryErrors(q: ErrorQuery): Promise<LogEntry[]> {
  if (q.app) {
    const src = sourceForApp(q.app)
    return src.configured() ? src.queryErrors(q) : []
  }
  const entries = await fanOut(configuredSources(), s => s.queryErrors(q))
  return entries.sort((a, b) => b.ts - a.ts)
}

// Busca a chamada Sonax pelo id (junta as fases). Sonax vive no BetterStack; se ele
// não estiver configurado, devolve vazio.
export async function queryBySonaxCall(
  callId: string,
  domain?: string,
  sinceHours?: number,
  limit?: number,
): Promise<LogEntry[]> {
  if (!betterStackSource.configured()) return []
  return bsQueryBySonaxCall(callId, domain, sinceHours, limit)
}
