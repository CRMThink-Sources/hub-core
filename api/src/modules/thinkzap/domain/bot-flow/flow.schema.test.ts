import { describe, expect, it } from 'vitest'
import { exampleFlow } from './example-flow'
import type { BotFlowGraph } from './flow'
import {
  type FlowIssueCode,
  parseBotFlowGraph,
  validateFlowGraph,
} from './flow.schema'

const codes = (graph: unknown): FlowIssueCode[] =>
  validateFlowGraph(graph).map(issue => issue.code)

const minimal: BotFlowGraph = {
  entryNodeId: 'a',
  settings: { escapeKeywords: [], escapeTarget: null },
  nodes: [
    { id: 'a', kind: 'message', text: 'oi', next: 'b' },
    { id: 'b', kind: 'finish' },
  ],
}

describe('parseBotFlowGraph', () => {
  it('aceita o fluxo de exemplo', () => {
    expect(parseBotFlowGraph(exampleFlow)).not.toBeNull()
  })

  it('recusa nó de tipo desconhecido', () => {
    expect(
      parseBotFlowGraph({
        entryNodeId: 'a',
        settings: { escapeKeywords: [], escapeTarget: null },
        nodes: [{ id: 'a', kind: 'carrossel', text: 'oi' }],
      }),
    ).toBeNull()
  })

  it('recusa nome de variável que não é identificador', () => {
    expect(
      parseBotFlowGraph({
        ...minimal,
        nodes: [
          {
            id: 'a',
            kind: 'input',
            text: 'nome?',
            saveAs: 'nome do cliente',
            validate: 'text',
            next: 'b',
            maxAttempts: 2,
            onExhausted: 'b',
          },
          { id: 'b', kind: 'finish' },
        ],
      }),
    ).toBeNull()
  })

  it('preenche settings quando o JSON não traz', () => {
    const parsed = parseBotFlowGraph({
      entryNodeId: 'a',
      nodes: minimal.nodes,
    })

    expect(parsed?.settings.escapeTarget).toBeNull()
  })
})

describe('validateFlowGraph', () => {
  it('o fluxo de exemplo é publicável', () => {
    expect(validateFlowGraph(exampleFlow)).toEqual([])
  })

  it('JSON que não é fluxo vira um problema de forma', () => {
    expect(codes({ nodes: 'nada' })).toEqual(['malformed'])
  })

  it('acusa entrada inexistente', () => {
    expect(codes({ ...minimal, entryNodeId: 'z' })).toContain('entry-not-found')
  })

  it('acusa destino que não existe', () => {
    expect(
      codes({
        ...minimal,
        nodes: [
          { id: 'a', kind: 'message', text: 'oi', next: 'fantasma' },
          { id: 'b', kind: 'finish' },
        ],
      }),
    ).toContain('target-not-found')
  })

  it('acusa id repetido', () => {
    expect(
      codes({
        ...minimal,
        nodes: [
          { id: 'a', kind: 'message', text: 'oi', next: 'a' },
          { id: 'a', kind: 'finish' },
        ],
      }),
    ).toContain('duplicate-node-id')
  })

  it('acusa nó órfão', () => {
    expect(
      codes({
        ...minimal,
        nodes: [
          ...minimal.nodes,
          {
            id: 'perdido',
            kind: 'message',
            text: 'ninguém chega aqui',
            next: 'b',
          },
        ],
      }),
    ).toContain('unreachable-node')
  })

  it('acusa ciclo que não espera resposta', () => {
    expect(
      codes({
        entryNodeId: 'a',
        settings: { escapeKeywords: [], escapeTarget: null },
        nodes: [
          { id: 'a', kind: 'message', text: 'gira', next: 'b' },
          { id: 'b', kind: 'message', text: 'gira', next: 'a' },
        ],
      }),
    ).toContain('loop-without-wait')
  })

  it('re-pergunta não é ciclo: passa por nó de espera', () => {
    const issues = codes({
      entryNodeId: 'q',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'q',
          kind: 'question',
          text: 'sim ou não?',
          options: [
            { value: 'sim', label: 'Sim', next: 'fim' },
            { value: 'nao', label: 'Não', next: 'q' },
          ],
          maxAttempts: 2,
          onExhausted: 'fim',
        },
        { id: 'fim', kind: 'finish' },
      ],
    })

    expect(issues).not.toContain('loop-without-wait')
    expect(issues).toEqual([])
  })

  it('acusa fluxo que nunca termina', () => {
    expect(
      codes({
        entryNodeId: 'q',
        settings: { escapeKeywords: [], escapeTarget: null },
        nodes: [
          {
            id: 'q',
            kind: 'question',
            text: 'e agora?',
            options: [{ value: 'x', label: 'X', next: 'q' }],
            maxAttempts: 2,
            onExhausted: 'q',
          },
        ],
      }),
    ).toContain('no-terminal-reachable')
  })

  it('acusa saída de emergência sem atendente escolhido', () => {
    expect(
      codes({
        ...minimal,
        settings: {
          escapeKeywords: ['atendente'],
          escapeTarget: { type: 'user', bitrixUserId: '' },
        },
      }),
    ).toContain('escape-target-incomplete')
  })

  it('migra o escape antigo que apontava para um handoff', () => {
    const parsed = parseBotFlowGraph({
      entryNodeId: 'a',
      settings: { escapeKeywords: ['atendente'], escapeNext: 'h' },
      nodes: [
        { id: 'a', kind: 'message', text: 'oi', next: 'h' },
        { id: 'h', kind: 'handoff', target: { type: 'line', lineId: '7' } },
      ],
    })

    expect(parsed?.settings.escapeTarget).toEqual({ type: 'line', lineId: '7' })
  })

  it('desliga o escape antigo que apontava para bloco que não entrega', () => {
    const parsed = parseBotFlowGraph({
      entryNodeId: 'a',
      settings: { escapeKeywords: ['atendente'], escapeNext: 'a' },
      nodes: [{ id: 'a', kind: 'finish' }],
    })

    expect(parsed?.settings.escapeTarget).toBeNull()
  })

  it('acusa valor de opção repetido, que faria a variável ser ambígua', () => {
    expect(
      codes({
        entryNodeId: 'q',
        settings: { escapeKeywords: [], escapeTarget: null },
        nodes: [
          {
            id: 'q',
            kind: 'question',
            text: 'qual?',
            saveAs: 'escolha',
            options: [
              { value: 'mesmo', label: 'Um', next: 'fim' },
              { value: 'mesmo', label: 'Dois', next: 'fim' },
            ],
            maxAttempts: 2,
            onExhausted: 'fim',
          },
          { id: 'fim', kind: 'finish' },
        ],
      }),
    ).toContain('duplicate-option-value')
  })

  it('devolve todos os problemas de uma vez, não só o primeiro', () => {
    const issues = validateFlowGraph({
      entryNodeId: 'z',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [{ id: 'a', kind: 'message', text: 'oi', next: 'fantasma' }],
    })

    expect(issues.length).toBeGreaterThan(1)
  })
})

describe('validateFlowGraph — destino não escolhido', () => {
  it('acusa bloco cujas saídas todas voltam para ele mesmo', () => {
    // É como a saída nasce no editor: sem isso o fluxo publicaria sem ir a lugar nenhum.
    const codigos = codes({
      entryNodeId: 'q',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'q',
          kind: 'question',
          text: 'menu',
          options: [{ value: 'x', label: 'X', next: 'q' }],
          maxAttempts: 2,
          onExhausted: 'q',
        },
        { id: 'fim', kind: 'handoff', target: { type: 'queue' } },
      ],
    })

    expect(codigos).toContain('self-target')
  })

  it('laço legítimo não é acusado quando há outra saída para frente', () => {
    // "Repetir o menu" numa opção e seguir na outra é fluxo válido.
    const codigos = codes({
      entryNodeId: 'q',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'q',
          kind: 'question',
          text: 'menu',
          options: [
            { value: 'r', label: 'Repetir', next: 'q' },
            { value: 's', label: 'Sair', next: 'fim' },
          ],
          maxAttempts: 2,
          onExhausted: 'fim',
        },
        { id: 'fim', kind: 'handoff', target: { type: 'queue' } },
      ],
    })

    expect(codigos).not.toContain('self-target')
    expect(codigos).toEqual([])
  })
})
