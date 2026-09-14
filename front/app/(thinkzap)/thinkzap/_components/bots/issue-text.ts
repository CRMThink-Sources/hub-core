import type { FlowIssue } from '@/shared/thinkzap-bot-flow'

/** Mensagem do problema em português. Os códigos vêm de `validateFlowGraph`. */
export const ISSUE_TEXT: Record<FlowIssue['code'], string> = {
  malformed: 'Bloco com dado inválido.',
  'duplicate-node-id': 'Dois blocos com o mesmo identificador.',
  'entry-not-found': 'O bloco inicial não existe.',
  'target-not-found': 'Ligação apontando para bloco que não existe.',
  'unreachable-node': 'Nada leva até este bloco.',
  'loop-without-wait':
    'Volta para trás sem perguntar nada — o bot giraria sozinho.',
  'no-terminal-reachable':
    'Deste bloco não se chega a um encerramento nem a um atendente.',
  'escape-target-incomplete':
    'Escolha para quem a saída de emergência transfere.',
  'duplicate-option-value': 'Duas opções com o mesmo valor.',
  'self-target': 'Escolha para onde as saídas deste bloco vão.',
  'handoff-target-incomplete': 'Escolha para quem a conversa é entregue.',
  'condition-var-invalid': 'A condição precisa de uma variável para testar.',
  'node-text-missing': 'Falta o texto que o bot envia neste bloco.',
}

/**
 * Códigos cujo `detail` do servidor diz algo que o texto fixo não diz — o id do
 * destino quebrado, o valor repetido. Nos outros o `detail` é a mesma frase em
 * linguagem de servidor, e mostrar os dois duplicaria a linha.
 */
const COM_DETALHE = new Set<FlowIssue['code']>([
  'target-not-found',
  'duplicate-option-value',
  'handoff-target-incomplete',
  'escape-target-incomplete',
  // Diz qual das condições, e se o nome está vazio ou inválido.
  'condition-var-invalid',
])

/**
 * Problema como o usuário lê.
 *
 * Sem o `detail`, dois `target-not-found` no mesmo bloco eram a mesma frase repetida e
 * não havia como saber qual saída consertar.
 */
export function issueText(issue: FlowIssue): string {
  const base = ISSUE_TEXT[issue.code]
  const detalhe = issue.detail?.trim()

  if (!detalhe || !COM_DETALHE.has(issue.code)) return base
  return `${base} (${detalhe})`
}
