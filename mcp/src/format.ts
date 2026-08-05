import type { LogEntry } from './log/source.js'

export function fmtTs(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', 'Z')
}

// Linha de timeline: hora + nível + msg; remediação quando classificada.
export function fmtEntry(e: LogEntry): string {
  const head = `${fmtTs(e.ts)} [${e.level}] ${e.msg}`
  if (!e.errorCode) return head
  const extra = [
    `errorCode: ${e.errorCode}`,
    e.remediation ? `remediação: ${e.remediation}` : '',
    e.count ? `linhas afetadas: ${e.count}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  return `${head}\n  → ${extra}`
}

export function fmtTimeline(traceKey: string, entries: LogEntry[]): string {
  const codes = [...new Set(entries.map(e => e.errorCode).filter(Boolean))]
  const tenant = entries.find(e => e.domain)?.domain
  const app = entries.find(e => e.app)?.app
  const header = [
    `Timeline do traceKey ${traceKey} (${entries.length} evento(s))`,
    tenant ? `domínio: ${tenant}` : '',
    app ? `app: ${app}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  const footer = codes.length
    ? `\n\nerrorCode(s): ${codes.join(', ')} → chame get_runbook para resolver.`
    : '\n\nNenhum errorCode classificado. Se há erro, pode estar sem classificar (UNCLASSIFIED) — escale pro dev.'
  return `${header}\n\n${entries.map(fmtEntry).join('\n')}${footer}`
}

// Timeline de uma chamada (junta as fases pelo id da chamada). Realça errorCodes e
// os traceKeys de cada fase, pra o suporte pivotar por fase se precisar.
export function fmtCallTimeline(callId: string, entries: LogEntry[]): string {
  const codes = [...new Set(entries.map(e => e.errorCode).filter(Boolean))]
  const traces = [...new Set(entries.map(e => e.traceKey).filter(Boolean))]
  const tenant = entries.find(e => e.domain)?.domain
  const header = [
    `Timeline da chamada ${callId} (${entries.length} evento(s))`,
    tenant ? `domínio: ${tenant}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
  const foot: string[] = []
  if (codes.length)
    foot.push(
      `errorCode(s): ${codes.join(', ')} → chame get_runbook para resolver.`,
    )
  if (traces.length) foot.push(`traceKey(s) por fase: ${traces.join(', ')}.`)
  const footer = foot.length ? `\n\n${foot.join('\n')}` : ''
  return `${header}\n\n${entries.map(fmtEntry).join('\n')}${footer}`
}

// Agrega por errorCode: nº de linhas, ocorrências (soma `count` da via C),
// último horário e traceKeys de exemplo.
export function fmtErrorAggregation(
  entries: LogEntry[],
  scope: string,
): string {
  type Agg = {
    lines: number
    affected: number
    last: number
    traces: Set<string>
    category?: string
  }
  const byCode = new Map<string, Agg>()
  for (const e of entries) {
    const code = e.errorCode ?? 'UNCLASSIFIED'
    const a = byCode.get(code) ?? {
      lines: 0,
      affected: 0,
      last: 0,
      traces: new Set<string>(),
      category: e.category,
    }
    a.lines += 1
    a.affected += e.count ?? 1
    a.last = Math.max(a.last, e.ts)
    if (e.traceKey && a.traces.size < 5) a.traces.add(e.traceKey)
    byCode.set(code, a)
  }
  const blocks = [...byCode.entries()]
    .sort((a, b) => b[1].last - a[1].last)
    .map(([code, a]) => {
      const cat = a.category ? ` [${a.category}]` : ''
      const traces = a.traces.size
        ? `\n  traceKeys: ${[...a.traces].join(', ')}`
        : ''
      return (
        `${code}${cat} — ${a.lines} linha(s), ${a.affected} ocorrência(s), ` +
        `última: ${fmtTs(a.last)}${traces}`
      )
    })
  return (
    `Erros classificados${scope ? ` (${scope})` : ''}:\n\n` +
    blocks.join('\n') +
    `\n\nUse query_by_trace(traceKey) num exemplo, depois get_runbook(errorCode).`
  )
}
