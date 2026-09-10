import { describe, expect, it } from 'vitest'
import { makeNode, type BotFlowGraph } from './thinkzap-bot-flow'
import { readingOrder } from './thinkzap-flow-layout'
import { graphEdges } from './thinkzap-flow-graph'
import { canvasEdges } from './thinkzap-flow-edges'

describe('readingOrder', () => {
  /**
   * O número do bloco vinha do índice no array, que é a ordem de criação. Trocar o
   * início, ou criar blocos fora de ordem, fazia a entrada aparecer numerada depois de
   * blocos que só acontecem mais tarde na conversa.
   */
  it('a entrada é sempre 1, mesmo criada por último', () => {
    const graph: BotFlowGraph = {
      entryNodeId: 'n3',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        { id: 'n1', kind: 'finish', text: 'fim' },
        { id: 'n2', kind: 'message', text: 'meio', next: 'n1' },
        { id: 'n3', kind: 'message', text: 'começo', next: 'n2' },
      ],
    }

    const ordens = readingOrder(graph)

    expect(ordens.get('n3')).toBe(1)
    expect(ordens.get('n2')).toBe(2)
    expect(ordens.get('n1')).toBe(3)
  })

  it('bloco inalcançável vai para o fim', () => {
    const graph: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        { id: 'n1', kind: 'message', text: 'oi', next: 'n2' },
        { id: 'n2', kind: 'finish', text: 'fim' },
        { id: 'orfao', kind: 'finish', text: 'solto' },
      ],
    }

    expect(readingOrder(graph).get('orfao')).toBe(3)
  })

  it('numera todo bloco, sem repetir', () => {
    const graph: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        { id: 'n1', kind: 'message', text: 'oi', next: 'n2' },
        { id: 'n2', kind: 'message', text: 'dois', next: 'n1' },
        { id: 'n3', kind: 'finish', text: 'solto' },
      ],
    }

    const ordens = readingOrder(graph)
    const numeros = [...ordens.values()].sort()

    expect(ordens.size).toBe(3)
    expect(numeros).toEqual([1, 2, 3])
  })

  it('entrada que não existe no grafo não quebra', () => {
    const graph: BotFlowGraph = {
      entryNodeId: 'sumiu',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [{ id: 'n1', kind: 'finish', text: 'fim' }],
    }

    expect(readingOrder(graph).get('n1')).toBe(1)
  })
})

describe('saída pendente não vira linha', () => {
  /**
   * Bloco novo nasce com as saídas apontando para si mesmo — é assim que o fluxo diz
   * "sem destino". Desenhar isso produzia um laço curto colado no cartão: curto demais
   * para clicar (e portanto para apagar) e indistinguível de uma ligação real.
   */
  const graph: BotFlowGraph = {
    entryNodeId: 'n1',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes: [
      { ...makeNode('handoff', 'n1'), position: { x: 700, y: 60 } },
      { ...makeNode('question', 'n2'), position: { x: 300, y: 300 } },
      { ...makeNode('input', 'n3'), position: { x: 260, y: 620 } },
    ],
  }

  it('blocos novos não geram aresta nenhuma', () => {
    expect(graphEdges(graph)).toEqual([])
    expect(canvasEdges(graph)).toEqual([])
  })

  it('a aresta aparece quando a saída ganha destino de verdade', () => {
    const ligado: BotFlowGraph = {
      ...graph,
      nodes: graph.nodes.map(node =>
        node.id === 'n3' && node.kind === 'input'
          ? { ...node, next: 'n1' }
          : node,
      ),
    }

    expect(canvasEdges(ligado).map(edge => edge.id)).toEqual(['n3:next'])
  })

  it('autoligação feita à mão também não é desenhada', () => {
    // `setPortTarget` recusa, mas fluxo salvo antes da regra pode conter.
    const laco: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [{ id: 'n1', kind: 'message', text: 'oi', next: 'n1' }],
    }

    expect(canvasEdges(laco)).toEqual([])
  })
})

describe('readingOrder com grafo sujo', () => {
  /**
   * `validateFlowGraph` **reporta** id repetido (`duplicate-node-id`), não impede: o
   * grafo chega assim no canvas. Sem checar `visto` no varrimento final, o repetido
   * entrava duas vezes na lista e consumia um número, deslocando todos os seguintes.
   */
  it('id repetido não consome dois números', () => {
    const sujo: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        { id: 'n1', kind: 'message', text: 'a', next: 'n1' },
        { id: 'orfao', kind: 'finish', text: 'z' },
        { id: 'orfao', kind: 'finish', text: 'z' },
      ],
    }

    const ordens = readingOrder(sujo)

    expect(ordens.get('n1')).toBe(1)
    expect(ordens.get('orfao')).toBe(2)
    expect(ordens.size).toBe(2)
  })

  it('entrada inexistente não quebra a numeração', () => {
    const semEntrada: BotFlowGraph = {
      entryNodeId: 'sumiu',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [{ id: 'n1', kind: 'finish', text: 'z' }],
    }

    expect(readingOrder(semEntrada).get('n1')).toBe(1)
  })
})
