import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { autoLayout, nodeHeight, relayout } from './thinkzap-flow-layout'

/** Pergunta com três opções, cada uma indo para um bloco diferente. */
const leque: BotFlowGraph = {
  entryNodeId: 'q',
  settings: { escapeKeywords: [], escapeTarget: null },
  nodes: [
    {
      id: 'q',
      kind: 'question',
      text: 'qual?',
      maxAttempts: 2,
      options: [
        { label: 'a', value: 'a', next: 'f1' },
        { label: 'b', value: 'b', next: 'f2' },
        { label: 'c', value: 'c', next: 'f3' },
      ],
      onExhausted: 'f3',
    },
    { id: 'f1', kind: 'finish', text: '1' },
    { id: 'f2', kind: 'finish', text: '2' },
    { id: 'f3', kind: 'finish', text: '3' },
  ],
} as unknown as BotFlowGraph

describe('autoLayout', () => {
  it('põe cada camada numa coluna', () => {
    const pos = autoLayout(leque)

    const xDoPai = pos.get('q')?.x ?? 0
    for (const filho of ['f1', 'f2', 'f3']) {
      expect(pos.get(filho)?.x).toBeGreaterThan(xDoPai)
    }
  })

  it('os filhos ficam centrados no pai, não empilhados abaixo', () => {
    // Compara centros: é do centro do cartão que as saídas partem.
    const pos = autoLayout(leque)
    const centro = (id: string) => {
      const node = leque.nodes.find(atual => atual.id === id)!
      return (pos.get(id)?.y ?? 0) + nodeHeight(node) / 2
    }

    const centros = ['f1', 'f2', 'f3'].map(centro)
    const meioDosFilhos = (Math.min(...centros) + Math.max(...centros)) / 2

    expect(meioDosFilhos).toBeCloseTo(centro('q'), 5)
  })

  it('cartão alto não invade o de baixo', () => {
    // Passo vertical fixo fazia o cartão de muitas saídas cobrir o vizinho.
    const pos = autoLayout(leque)
    const ordenados = ['f1', 'f2', 'f3']
      .map(id => ({
        y: pos.get(id)?.y ?? 0,
        altura: nodeHeight(leque.nodes.find(node => node.id === id)!),
      }))
      .sort((a, b) => a.y - b.y)

    for (let i = 1; i < ordenados.length; i += 1) {
      expect(ordenados[i].y).toBeGreaterThanOrEqual(
        ordenados[i - 1].y + ordenados[i - 1].altura,
      )
    }
  })

  it('filhos na ordem das saídas do pai', () => {
    const pos = autoLayout(leque)

    const y1 = pos.get('f1')?.y ?? 0
    const y2 = pos.get('f2')?.y ?? 0
    const y3 = pos.get('f3')?.y ?? 0

    expect(y1).toBeLessThan(y2)
    expect(y2).toBeLessThan(y3)
  })

  it('nenhum bloco ocupa a mesma posição', () => {
    const pos = autoLayout(leque)
    const chaves = [...pos.values()].map(p => `${p.x},${p.y}`)

    expect(new Set(chaves).size).toBe(chaves.length)
  })

  it('bloco inalcançável também recebe lugar', () => {
    const comOrfao: BotFlowGraph = {
      ...leque,
      nodes: [
        ...leque.nodes,
        { id: 'orfao', kind: 'finish', text: 'x' },
      ] as BotFlowGraph['nodes'],
    }

    expect(autoLayout(comOrfao).has('orfao')).toBe(true)
  })

  it('grafo vazio não quebra', () => {
    const vazio: BotFlowGraph = {
      entryNodeId: 'nao-existe',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [],
    }

    expect(() => autoLayout(vazio)).not.toThrow()
    expect(autoLayout(vazio).size).toBe(0)
  })

  it('laço não trava a varredura', () => {
    const ciclo: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        { id: 'n1', kind: 'message', text: 'a', next: 'n2' },
        { id: 'n2', kind: 'message', text: 'b', next: 'n1' },
      ],
    } as unknown as BotFlowGraph

    expect(autoLayout(ciclo).size).toBe(2)
  })
})

describe('relayout', () => {
  it('descarta as posições salvas', () => {
    const torto: BotFlowGraph = {
      ...leque,
      nodes: leque.nodes.map(node => ({
        ...node,
        position: { x: 9999, y: 9999 },
      })),
    }

    for (const node of relayout(torto).nodes) {
      expect(node.position).not.toEqual({ x: 9999, y: 9999 })
    }
  })
})
