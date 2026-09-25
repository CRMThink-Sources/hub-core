import type { FlowIssue, FlowIssueCode } from '@/shared/thinkzap-bot-flow'

/** Frase do problema traduzida — `t` do namespace `thinkzap/bots/editor`. */
export type IssueTranslate = (code: FlowIssueCode) => string

/**
 * Códigos cujo `detail` do servidor diz algo que o texto fixo não diz — o id do
 * destino quebrado, o valor repetido. Nos outros o `detail` é a mesma frase em
 * linguagem de servidor, e mostrar os dois duplicaria a linha.
 */
const COM_DETALHE = new Set<FlowIssueCode>([
  'target-not-found',
  'duplicate-option-value',
  // Diz qual das opções da lista está em branco.
  'option-label-missing',
  'handoff-target-incomplete',
  'escape-target-incomplete',
  // Diz qual das condições, e se o nome está vazio ou inválido.
  'condition-var-invalid',
])

/**
 * Problema como o usuário lê.
 *
 * Sem o `detail`, dois `target-not-found` no mesmo bloco eram a mesma frase repetida e
 * não havia como saber qual saída consertar. O `detail` vem do servidor e não é
 * traduzido: é dado do grafo (id do destino, valor repetido), não frase.
 */
export function issueText(issue: FlowIssue, traduzir: IssueTranslate): string {
  const base = traduzir(issue.code)
  const detalhe = issue.detail?.trim()

  if (!detalhe || !COM_DETALHE.has(issue.code)) return base
  return `${base} (${detalhe})`
}
