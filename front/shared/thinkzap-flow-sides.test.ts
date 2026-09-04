import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { graphEdges } from './thinkzap-flow-graph'
import { entrySide, entrySides, inHandleId } from './thinkzap-flow-sides'

describe('entrySide', () => {
  it('entra pela esquerda quando vem da esquerda', () => {
    expect(entrySide({ x: 0, y: 0 }, { x: 400, y: 0 })).toBe('left')
  })

  it('entra pela direita quando vem da direita', () => {
    expect(entrySide({ x: 400, y: 0 }, { x: 0, y: 0 })).toBe('right')
  })

  it('entra por cima quando vem de cima', () => {
    expect(entrySide({ x: 0, y: -400 }, { x: 0, y: 0 })).toBe('top')
  })

  it('entra por baixo quando vem de baixo', () => {
    expect(entrySide({ x: 0, y: 400 }, { x: 0, y: 0 })).toBe('bottom')
  })

  it('bloco logo acima entra por cima, apesar do desvio horizontal', () => {
    // 40px de lado contra 200 de altura: sem normalizar pelo formato, cairia em 'left'.
    expect(entrySide({ x: -40, y: -200 }, { x: 0, y: 0 })).toBe('top')
  })

  it('bloco na coluna anterior entra pela esquerda, apesar do desvio vertical', () => {
    expect(entrySide({ x: -400, y: -60 }, { x: 0, y: 0 })).toBe('left')
  })

  it('mesma posição não quebra', () => {
    expect(entrySide({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe('right')
  })
})

describe('inHandleId', () => {
  it('gera id por lado', () => {
    expect(inHandleId('left')).toBe('in:left')
    expect(inHandleId('bottom')).toBe('in:bottom')
  })
})

describe('entrySides', () => {
  const graph: BotFlowGraph = {
    entryNodeId: 'n1',
    nodes: [
      {
        id: 'n1',
        kind: 'message',
        text: 'oi',
        next: 'n2',
        position: { x: 0, y: 0 },
      },
      {
        id: 'n2',
        kind: 'question',
        text: 'qual?',
        maxAttempts: 2,
        options: [
          { label: 'a', value: 'a', next: 'n3' },
          { label: 'b', value: 'b', next: 'n1' },
        ],
        onExhausted: 'n3',
        position: { x: 400, y: 0 },
      },
      {
        id: 'n3',
        kind: 'finish',
        text: 'tchau',
        position: { x: 400, y: 300 },
      },
    ],
    settings: { escapeKeywords: [], escapeNext: null },
  }

  it('mapeia o lado de cada saída', () => {
    const lados = entrySides(graph)

    // n1 está à esquerda de n2
    expect(lados.get('n1:next')).toBe('left')
    // n3 está abaixo de n2
    expect(lados.get('n2:option:0')).toBe('top')
    // volta para n1, que está à esquerda
    expect(lados.get('n2:option:1')).toBe('right')
  })

  it('cobre a saída de esgotamento', () => {
    expect(entrySides(graph).get('n2:exhausted')).toBe('top')
  })

  it('bloco terminal não gera entrada', () => {
    const lados = entrySides(graph)
    expect([...lados.keys()].some(key => key.startsWith('n3:'))).toBe(false)
  })

  it('bloco sem posição não quebra o mapa', () => {
    const semPos: BotFlowGraph = {
      ...graph,
      nodes: graph.nodes.map(node =>
        node.id === 'n2' ? { ...node, position: undefined } : node,
      ),
    }
    expect(() => entrySides(semPos)).not.toThrow()
  })
})

describe('casamento com graphEdges', () => {
  /**
   * `entrySides` indexa por `${nodeId}:${portId}` e `graphEdges` gera o `id` no mesmo
   * formato. Divergir aqui não quebra nada visível: o lookup falha, cai no lado padrão
   * e a linha volta a entrar sempre no mesmo ponto — o bug que isto veio resolver.
   */
  it('toda aresta do grafo encontra o seu lado', () => {
    const graph: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        {
          id: 'n1',
          kind: 'message',
          text: 'oi',
          next: 'n2',
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          kind: 'question',
          text: 'q',
          maxAttempts: 2,
          position: { x: 400, y: 0 },
          options: [
            { label: 'a', value: 'a', next: 'n3' },
            { label: 'b', value: 'b', next: 'n1' },
          ],
          onExhausted: 'n3',
        },
        {
          id: 'n3',
          kind: 'condition',
          position: { x: 400, y: 300 },
          branches: [{ when: { var: 'x', op: 'notEmpty' }, next: 'n1' }],
          otherwise: 'n2',
        },
        {
          id: 'n4',
          kind: 'input',
          text: 'cpf?',
          saveAs: 'cpf',
          validate: 'cpf',
          maxAttempts: 2,
          next: 'n1',
          onExhausted: 'n2',
          position: { x: 800, y: 0 },
        },
      ],
    }

    const lados = entrySides(graph)
    const semLado = graphEdges(graph).filter(edge => !lados.get(edge.id))

    expect(semLado.map(edge => edge.id)).toEqual([])
  })
})
