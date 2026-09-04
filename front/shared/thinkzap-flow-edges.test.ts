import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { canvasEdges, edgesKey } from './thinkzap-flow-edges'

const base: BotFlowGraph = {
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
      text: 'qual?',
      maxAttempts: 2,
      position: { x: 400, y: 0 },
      options: [{ label: 'a', value: 'a', next: 'n3' }],
      onExhausted: 'n3',
    },
    {
      id: 'n3',
      kind: 'finish',
      text: 'tchau',
      position: { x: 800, y: 0 },
    },
  ],
}

describe('canvasEdges', () => {
  it('resolve o lado de entrada de cada aresta', () => {
    const edges = canvasEdges(base)

    expect(edges).toHaveLength(3)
    expect(edges.every(edge => edge.targetHandle.startsWith('in:'))).toBe(true)
  })

  it('leva o rótulo da porta', () => {
    const option = canvasEdges(base).find(edge => edge.id === 'n2:option:0')
    expect(option?.label).toBe('a')
  })
})

/**
 * O React Flow compara aresta por referência (`getElementsDiffChanges`): objeto novo
 * vira `replace`, e um `replace` em todas as arestas descarta a seleção que ele guarda
 * no store — deixando o Delete sem nada para apagar. Estes testes travam o que pode e o
 * que não pode invalidar as arestas.
 */
describe('edgesKey', () => {
  it('não muda ao mover um bloco', () => {
    // Arrastar devolve a posição para o grafo; nenhuma aresta mudou de desenho.
    const movido: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n3' ? { ...node, position: { x: 820, y: 10 } } : node,
      ),
    }

    expect(edgesKey(movido)).toBe(edgesKey(base))
  })

  it('não muda ao editar a fala de um bloco', () => {
    const editado: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n1' ? { ...node, text: 'outra fala' } : node,
      ),
    }

    expect(edgesKey(editado)).toBe(edgesKey(base))
  })

  it('não muda ao renomear um bloco', () => {
    const nomeado: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n2' ? { ...node, name: 'Menu' } : node,
      ),
    }

    expect(edgesKey(nomeado)).toBe(edgesKey(base))
  })

  it('muda quando um destino muda', () => {
    const religado: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n1' ? { ...node, next: 'n3' } : node,
      ),
    }

    expect(edgesKey(religado)).not.toBe(edgesKey(base))
  })

  it('muda quando o rótulo de uma opção muda', () => {
    const renomeado: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n2' && node.kind === 'question'
          ? { ...node, options: [{ label: 'b', value: 'a', next: 'n3' }] }
          : node,
      ),
    }

    expect(edgesKey(renomeado)).not.toBe(edgesKey(base))
  })

  it('muda quando mover um bloco muda o lado de entrada', () => {
    // n3 sai da direita de n2 para debaixo dele: a linha passa a entrar por cima.
    const abaixo: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n3' ? { ...node, position: { x: 400, y: 400 } } : node,
      ),
    }

    expect(edgesKey(abaixo)).not.toBe(edgesKey(base))
  })

  it('muda quando uma aresta é removida', () => {
    const semOpcao: BotFlowGraph = {
      ...base,
      nodes: base.nodes.map(node =>
        node.id === 'n2' && node.kind === 'question'
          ? { ...node, options: [] }
          : node,
      ),
    }

    expect(edgesKey(semOpcao)).not.toBe(edgesKey(base))
  })
})
