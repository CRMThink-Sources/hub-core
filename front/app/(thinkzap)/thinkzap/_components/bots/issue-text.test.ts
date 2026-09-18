import { describe, expect, it } from 'vitest'
import type { FlowIssue, FlowIssueCode } from '@/shared/thinkzap-bot-flow'
import { issueText } from './issue-text'
import pt from '@/messages/pt/thinkzap/bots/editor.json'
import en from '@/messages/en/thinkzap/bots/editor.json'
import es from '@/messages/es/thinkzap/bots/editor.json'

const CODIGOS: FlowIssueCode[] = [
  'malformed',
  'duplicate-node-id',
  'entry-not-found',
  'target-not-found',
  'unreachable-node',
  'loop-without-wait',
  'no-terminal-reachable',
  'escape-target-incomplete',
  'duplicate-option-value',
  'self-target',
  'handoff-target-incomplete',
  'condition-var-invalid',
  'node-text-missing',
]

/** O `t` real resolve `problemas.<code>` no namespace do editor. */
const traduzir = (code: FlowIssueCode) => pt.problemas[code]

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

    expect(issueText(issue, traduzir)).toContain('n9')
  })

  it('não repete o detalhe quando ele é a frase em outra língua', () => {
    const issue: FlowIssue = {
      code: 'unreachable-node',
      nodeId: 'n5',
      detail: 'nenhum caminho da entrada chega neste nó',
    }

    expect(issueText(issue, traduzir)).toBe(pt.problemas['unreachable-node'])
  })

  it('detalhe ausente ou em branco não deixa parênteses vazios', () => {
    expect(issueText({ code: 'target-not-found' }, traduzir)).toBe(
      pt.problemas['target-not-found'],
    )
    expect(
      issueText({ code: 'target-not-found', detail: '   ' }, traduzir),
    ).toBe(pt.problemas['target-not-found'])
  })

  // Código sem chave sairia como a própria chave na tela, em qualquer idioma.
  it('todo código tem texto nos três idiomas', () => {
    for (const messages of [pt, en, es]) {
      const problemas: Record<string, string> = messages.problemas
      for (const code of CODIGOS) {
        expect(problemas[code]).toBeTruthy()
      }
      expect(CODIGOS).toHaveLength(Object.keys(problemas).length)
    }
  })
})
