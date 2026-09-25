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
            kind: 'message',
            text: 'nome?',
            capture: 'nome do cliente',
            next: 'b',
          },
          { id: 'b', kind: 'finish' },
        ],
      }),
    ).toBeNull()
  })

  describe('fluxo salvo quando a captura era um bloco', () => {
    const antigo = {
      entryNodeId: 'a',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'a',
          kind: 'input',
          text: 'Data de nascimento?',
          saveAs: 'nascimento',
          validate: 'date',
          maxAttempts: 3,
          onExhausted: 'c',
          next: 'b',
        },
        {
          id: 'b',
          kind: 'condition',
          branches: [
            { when: { var: 'nascimento', op: 'notEmpty' }, next: 'c' },
          ],
          otherwise: 'c',
        },
        { id: 'c', kind: 'finish' },
      ],
    }

    it('o bloco de captura vira uma mensagem que captura', () => {
      const parsed = parseBotFlowGraph(antigo)
      const node = parsed?.nodes[0]

      expect(node).toEqual({
        id: 'a',
        kind: 'message',
        text: 'Data de nascimento?',
        capture: 'nascimento',
        next: 'b',
      })
    })

    it('a condição passa a testar o nome com namespace', () => {
      const parsed = parseBotFlowGraph(antigo)
      const condition = parsed?.nodes[1]

      expect(condition).toMatchObject({
        branches: [{ when: { var: 'capture.nascimento' } }],
      })
    })

    it('o vínculo de CRM da condição vira o nome do sistema', () => {
      const parsed = parseBotFlowGraph({
        ...antigo,
        nodes: [
          antigo.nodes[0],
          {
            ...antigo.nodes[1],
            branches: [
              { when: { var: 'contatoId', op: 'notEmpty' }, next: 'c' },
            ],
          },
          antigo.nodes[2],
        ],
      })

      expect(parsed?.nodes[1]).toMatchObject({
        branches: [{ when: { var: 'bitrix.contactId' } }],
      })
    })

    it('o `saveAs` da pergunta vira `capture`', () => {
      const parsed = parseBotFlowGraph({
        ...minimal,
        nodes: [
          {
            id: 'a',
            kind: 'question',
            text: 'qual?',
            saveAs: 'motivo',
            options: [{ value: 'x', label: 'X', next: 'b' }],
            maxAttempts: 2,
            onExhausted: 'b',
          },
          { id: 'b', kind: 'finish' },
        ],
      })

      expect(parsed?.nodes[0]).toMatchObject({ capture: 'motivo' })
    })
  })

  describe('variável interpolada no texto', () => {
    const comTexto = (text: string) => ({
      ...minimal,
      nodes: [
        { id: 'a', kind: 'message', text, next: 'b' },
        { id: 'b', kind: 'finish' },
      ],
    })

    it('aceita a variável do sistema', () => {
      expect(codes(comTexto('Olá {bitrix.name}'))).toEqual([])
    })

    it('aceita o que outro bloco captura', () => {
      const graph = {
        ...minimal,
        nodes: [
          {
            id: 'a',
            kind: 'message',
            text: 'Seu e-mail?',
            capture: 'email',
            next: 'b',
          },
          {
            id: 'b',
            kind: 'message',
            text: 'Anotei {capture.email}',
            next: 'c',
          },
          { id: 'c', kind: 'finish' },
        ],
      }

      expect(codes(graph)).toEqual([])
    })

    it('acusa a variável que ninguém define', () => {
      expect(codes(comTexto('Olá {capture.sumiu}'))).toEqual(['unknown-var'])
    })

    it('acusa a condição que testa variável de fora do fluxo', () => {
      const graph = {
        ...minimal,
        nodes: [
          {
            id: 'a',
            kind: 'condition',
            branches: [
              { when: { var: 'capture.sumiu', op: 'notEmpty' }, next: 'b' },
            ],
            otherwise: 'b',
          },
          { id: 'b', kind: 'finish' },
        ],
      }

      expect(codes(graph)).toEqual(['unknown-var'])
    })

    it('acusa a despedida do escape com variável inexistente', () => {
      const graph = {
        ...minimal,
        settings: {
          escapeKeywords: ['atendente'],
          escapeTarget: { type: 'queue' },
          escapeText: 'Até logo, {capture.sumiu}',
        },
      }

      expect(codes(graph)).toEqual(['unknown-var'])
    })
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

describe('opção sem rótulo', () => {
  const comOpcaoVazia = {
    ...minimal,
    nodes: [
      {
        id: 'q',
        kind: 'question',
        text: 'menu',
        options: [
          { value: '', label: '', next: 'fim' },
          { value: 's', label: 'Sair', next: 'fim' },
        ],
        maxAttempts: 2,
        onExhausted: 'fim',
      },
      { id: 'fim', kind: 'finish' },
    ],
  }

  // O editor cria a opção já vazia e o rascunho salva a cada tecla: recusar na forma
  // derrubava o autosave enquanto o autor digitava o rótulo.
  it('o rascunho salva, como já acontece com a variável da condição', () => {
    expect(parseBotFlowGraph(comOpcaoVazia)).not.toBeNull()
  })

  it('mas a publicação cobra, apontando qual opção', () => {
    const issues = validateFlowGraph(comOpcaoVazia)
    const opcao = issues.find(issue => issue.code === 'option-label-missing')

    expect(opcao?.nodeId).toBe('q')
    expect(opcao?.detail).toContain('opção 1')
  })

  it('duas opções em branco não viram "valor repetido"', () => {
    const codigos = codes({
      ...comOpcaoVazia,
      nodes: [
        {
          ...comOpcaoVazia.nodes[0],
          options: [
            { value: '', label: '', next: 'fim' },
            { value: '', label: '', next: 'fim' },
          ],
        },
        { id: 'fim', kind: 'finish' },
      ],
    })

    expect(codigos).not.toContain('duplicate-option-value')
    expect(codigos.filter(c => c === 'option-label-missing')).toHaveLength(2)
  })
})
