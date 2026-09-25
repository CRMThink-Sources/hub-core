// Espelho de `api/src/modules/thinkzap/domain/bot-flow/vars.ts`, mais o catálogo do `@`.

import type { BotFlowGraph, FlowNode } from './thinkzap-bot-flow'

export const CAPTURE_NAMESPACE = 'capture'

export function captureVar(name: string): string {
  return `${CAPTURE_NAMESPACE}.${name.trim()}`
}

const VAR_TOKEN = /[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*/

/** O que o servidor aceita em `capture`: identificador, sem o prefixo. */
export const CAPTURE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

const PLACEHOLDER = new RegExp(`\\{\\s*(${VAR_TOKEN.source})\\s*\\}`, 'g')

export function varsUsedIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(m => m[1]))]
}

export function renderVars(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_, name: string) => vars[name] ?? '')
}

export type FlowVar = {
  name: string
  origin: 'system' | 'capture'
  hint?: string
}

/** Espelha `SYSTEM_VARS` do servidor. */
export const SYSTEM_FLOW_VARS: FlowVar[] = [
  { name: 'bitrix.name', origin: 'system' },
  { name: 'bitrix.contactId', origin: 'system' },
  { name: 'bitrix.leadId', origin: 'system' },
  { name: 'bitrix.companyId', origin: 'system' },
  { name: 'bitrix.dealId', origin: 'system' },
]

export function nodeCapture(node: FlowNode): string | null {
  if (node.kind !== 'message' && node.kind !== 'question') return null
  return node.capture?.trim() || null
}

/**
 * Nome livre para uma captura nova. Repetido, o segundo bloco sobrescreveria o primeiro
 * sem aviso — e as duas respostas iriam para a mesma variável.
 */
export function nextCaptureName(vars: FlowVar[]): string {
  const usados = new Set(vars.map(item => item.name))

  if (!usados.has(captureVar('resposta'))) return 'resposta'

  for (let i = 2; ; i += 1) {
    const candidato = `resposta${i}`
    if (!usados.has(captureVar(candidato))) return candidato
  }
}

export function flowVars(graph: BotFlowGraph): FlowVar[] {
  const capturas = graph.nodes.flatMap((node): FlowVar[] => {
    const nome = nodeCapture(node)
    return nome
      ? [{ name: captureVar(nome), origin: 'capture', hint: node.name?.trim() }]
      : []
  })

  // Dois blocos podem capturar no mesmo nome; o seletor mostra um só.
  const porNome = new Map(capturas.map(item => [item.name, item]))

  return [...SYSTEM_FLOW_VARS, ...porNome.values()]
}
