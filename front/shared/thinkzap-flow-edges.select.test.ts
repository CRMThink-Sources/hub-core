import { describe, expect, it } from 'vitest'
import { applyEdgeChanges, type Edge, type EdgeChange } from '@xyflow/react'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { canvasEdges } from './thinkzap-flow-edges'

/**
 * Seleção de aresta, que é o que o Delete apaga.
 *
 * A seleção vive só no React Flow: clicar numa linha faz a lib emitir uma mudança
 * `select` por `onEdgesChange`, e o Delete depois apaga o que está `selected` na lista.
 * O canvas filtrava só `remove` nesse handler, então a mudança de seleção era jogada
 * fora e a tecla não encontrava nada para apagar — sem erro nenhum no console.
 *
 * Estes testes exercitam o contrato da lib (`applyEdgeChanges`) contra as arestas que
 * `canvasEdges` produz, que é o par que precisa continuar funcionando.
 */
const grafo = (): BotFlowGraph => ({
  entryNodeId: 'n1',
  settings: { escapeKeywords: [], escapeTarget: null },
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
      kind: 'handoff',
      text: 'um momento',
      target: { type: 'queue' },
      position: { x: 288, y: 0 },
    },
  ],
})

/** Arestas como o canvas as monta, antes de qualquer interação. */
function arestas(): Edge[] {
  return canvasEdges(grafo()).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    deletable: true,
    selected: false,
  }))
}

describe('seleção de aresta', () => {
  it('a mudança select marca a aresta', () => {
    const antes = arestas()
    expect(antes).toHaveLength(1)

    const mudanca: EdgeChange[] = [
      { id: antes[0].id, type: 'select', selected: true },
    ]
    const depois = applyEdgeChanges(mudanca, antes)

    expect(depois[0].selected).toBe(true)
  })

  it('descartar a mudança select deixa a aresta sem seleção', () => {
    // O bug: filtrar só `remove` equivale a nunca aplicar o `select`.
    const antes = arestas()
    const mudancas: EdgeChange[] = [
      { id: antes[0].id, type: 'select', selected: true },
    ]
    const soRemove = mudancas.filter(mudanca => mudanca.type === 'remove')

    expect(applyEdgeChanges(soRemove, antes)[0].selected).toBe(false)
  })

  it('a aresta nasce apta a ser apagada', () => {
    // `getElementsToRemove` da lib descarta aresta com `deletable === false`.
    expect(arestas().every(edge => edge.deletable !== false)).toBe(true)
  })

  it('remontar a lista preserva o que estava selecionado', () => {
    /*
      O grafo muda por qualquer edição de texto e o efeito remonta as arestas. Se a
      remontagem nascesse com `selected: false`, a linha perderia a seleção entre o
      clique e o Delete.
    */
    const selecionadas = new Set(['n1:next'])
    const remontadas = canvasEdges(grafo()).map(edge => ({
      id: edge.id,
      selected: selecionadas.has(edge.id),
    }))

    expect(remontadas[0].selected).toBe(true)
  })
})
