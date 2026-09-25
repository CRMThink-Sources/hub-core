// `capture.*` é o que o cliente respondeu; `bitrix.*` é o que o portal já sabia.

export const CAPTURE_NAMESPACE = 'capture'
export const SYSTEM_NAMESPACE = 'bitrix'

/**
 * Opção escolhida numa pergunta sem captura. Não é variável de fluxo — o editor não a
 * oferece no `@` e nada a interpola: existe para o resumo do handoff saber por onde o
 * cliente passou, já que pergunta sem captura não deixava rastro nenhum.
 */
export const CHOICE_NAMESPACE = 'choice'

export function captureVar(name: string): string {
  return `${CAPTURE_NAMESPACE}.${name.trim()}`
}

export function choiceVar(nodeId: string): string {
  return `${CHOICE_NAMESPACE}.${nodeId}`
}

/** `Y`/`N`, do expediente do canal. Ausente vale como `Y`. */
export const WORKING_HOURS_VAR = 'bitrix.withinWorkingHours'

/** Contrato com todo fluxo publicado que os interpole. */
export const SYSTEM_VARS = [
  'bitrix.name',
  'bitrix.contactId',
  'bitrix.leadId',
  'bitrix.companyId',
  'bitrix.dealId',
  WORKING_HOURS_VAR,
] as const

export type SystemVar = (typeof SYSTEM_VARS)[number]

/** Sem âncoras: serve também de token na varredura do texto. */
const VAR_TOKEN = /[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*/

export const VAR_NAME_PATTERN = new RegExp(`^${VAR_TOKEN.source}$`)

const PLACEHOLDER = new RegExp(`\\{\\s*(${VAR_TOKEN.source})\\s*\\}`, 'g')

/** Variável sem valor vira vazio: o cliente não tem contexto para ler `{bitrix.name}`. */
export function renderVars(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_, name: string) => vars[name] ?? '')
}

export function varsUsedIn(text: string): string[] {
  const found = [...text.matchAll(PLACEHOLDER)].map(match => match[1] as string)
  return [...new Set(found)]
}
