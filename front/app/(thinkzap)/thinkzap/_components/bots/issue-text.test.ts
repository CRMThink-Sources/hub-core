import { describe, expect, it } from 'vitest'
import type { FlowIssue, FlowIssueCode } from '@/shared/thinkzap-bot-flow'
import { ISSUE_TEXT, issueText } from './issue-text'

const CODIGOS: FlowIssueCode[] = [
  'malformed',
  'duplicate-node-id',
  'entry-not-found',
  'target-not-found',
  'unreachable-node',
  'loop-without-wait',
  'no-terminal-reachable',
  'escape-target-not-found',
  'duplicate-option-value',
  'self-target',
  'handoff-target-incomplete',
  'condition-var-invalid',
  'node-text-missing',
]

/**
 * O servidor manda o dado exato em `detail` (qual destino, qual valor) e o front
 * mostrava só a frase fixa do código. Dois `target-not-found` no mesmo bloco eram a
 * mesma linha repetida, sem dizer qual saída consertar.
 */
describe('issueText', () => {
  it('mostra o detalhe quando ele diz algo novo', () => {
    const issue: FlowIssue = {
      code: 'target-not-found',
      nodeId: 'n2',
      detail: 'destino "n9" não existe',
    }

    expect(issueText(issue)).toContain('n9')
  })

  it('não repete o detalhe quando ele é a frase em outra língua', () => {
    const issue: FlowIssue = {
      code: 'unreachable-node',
      nodeId: 'n5',
      detail: 'nenhum caminho da entrada chega neste nó',
    }

    expect(issueText(issue)).toBe(ISSUE_TEXT['unreachable-node'])
  })

  it('detalhe ausente ou em branco não deixa parênteses vazios', () => {
    expect(issueText({ code: 'target-not-found' })).toBe(
      ISSUE_TEXT['target-not-found'],
    )
    expect(issueText({ code: 'target-not-found', detail: '   ' })).toBe(
      ISSUE_TEXT['target-not-found'],
    )
  })

  it('todo código tem texto — sem isso a linha sairia `undefined`', () => {
    for (const code of CODIGOS) {
      expect(ISSUE_TEXT[code]).toBeTruthy()
      expect(issueText({ code })).toBeTruthy()
    }
    expect(CODIGOS).toHaveLength(Object.keys(ISSUE_TEXT).length)
  })
})
