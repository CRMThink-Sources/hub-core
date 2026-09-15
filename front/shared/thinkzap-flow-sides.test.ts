import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { graphEdges } from './thinkzap-flow-graph'
import {
  LANES,
  LANES_POR_LADO,
  entrySide,
  entrySides,
  inHandleId,
  lanePercent,
} from './thinkzap-flow-sides'

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
  it('gera id por lado e faixa', () => {
    expect(inHandleId('left', 0)).toBe('in:left:0')
    expect(inHandleId('bottom', 2)).toBe('in:bottom:2')
  })
})

describe('lanePercent', () => {
  it('distribui as faixas sem encostar nas quinas', () => {
    // 0% ou 100% poriam o traço na quina do cartão, onde ele encosta na borda arredondada.
    for (const lane of LANES) {
      expect(lanePercent(lane)).toBeGreaterThan(0)
      expect(lanePercent(lane)).toBeLessThan(1)
    }
  })

  it('a faixa do meio fica no centro do lado', () => {
    expect(lanePercent(Math.floor(LANES_POR_LADO / 2))).toBe(0.5)
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
    settings: { escapeKeywords: [], escapeTarget: null },
  }

  it('mapeia o lado de cada saída', () => {
    const lados = entrySides(graph)

    // n1 está à esquerda de n2
    expect(lados.get('n1:next')?.side).toBe('left')
    // n3 está abaixo de n2
    expect(lados.get('n2:option:0')?.side).toBe('top')
    // volta para n1, que está à esquerda
    expect(lados.get('n2:option:1')?.side).toBe('right')
  })

  it('cobre a saída de esgotamento', () => {
    expect(entrySides(graph).get('n2:exhausted')?.side).toBe('top')
  })

  it('chegada sozinha no lado usa a faixa do meio', () => {
    // O caso comum não muda de aparência: entra pelo centro, como antes das faixas.
    expect(entrySides(graph).get('n1:next')?.lane).toBe(
      Math.floor(LANES_POR_LADO / 2),
    )
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

/** Era o bug: N arestas no mesmo lado terminavam no mesmo pixel, sobrepostas. */
describe('faixas quando várias arestas chegam pelo mesmo lado', () => {
  /** Três blocos empilhados à esquerda, todos ligando no mesmo destino. */
  const convergente: BotFlowGraph = {
    entryNodeId: 'a',
    settings: { escapeKeywords: [], escapeTarget: null },
    nodes: [
      {
        id: 'a',
        kind: 'message',
        text: 'a',
        next: 'destino',
        position: { x: 0, y: 0 },
      },
      {
        id: 'b',
        kind: 'message',
        text: 'b',
        next: 'destino',
        position: { x: 0, y: 200 },
      },
      {
        id: 'c',
        kind: 'message',
        text: 'c',
        next: 'destino',
        position: { x: 0, y: 400 },
      },
      {
        id: 'destino',
        kind: 'finish',
        text: 'fim',
        position: { x: 400, y: 200 },
      },
    ],
  }

  it('as três entram pelo mesmo lado', () => {
    const lados = entrySides(convergente)

    for (const chave of ['a:next', 'b:next', 'c:next']) {
      expect(lados.get(chave)?.side).toBe('left')
    }
  })

  it('cada uma recebe uma faixa diferente', () => {
    const lados = entrySides(convergente)
    const faixas = ['a:next', 'b:next', 'c:next'].map(
      chave => lados.get(chave)?.lane,
    )

    expect(new Set(faixas).size).toBe(3)
  })

  it('a faixa segue a ordem vertical da origem', () => {
    // Quem vem de cima entra pela faixa de cima: cruzar para alcançar a faixa desfaria
    // o ganho de separá-las.
    const lados = entrySides(convergente)

    const deA = lados.get('a:next')?.lane ?? -1
    const deB = lados.get('b:next')?.lane ?? -1
    const deC = lados.get('c:next')?.lane ?? -1

    expect(deA).toBeLessThan(deB)
    expect(deB).toBeLessThan(deC)
  })

  it('mais chegadas que faixas não estoura o limite', () => {
    const muitos: BotFlowGraph = {
      ...convergente,
      nodes: [
        ...convergente.nodes,
        {
          id: 'd',
          kind: 'message',
          text: 'd',
          next: 'destino',
          position: { x: 0, y: 600 },
        },
        {
          id: 'e',
          kind: 'message',
          text: 'e',
          next: 'destino',
          position: { x: 0, y: 800 },
        },
      ],
    }

    for (const entrada of entrySides(muitos).values()) {
      expect(entrada.lane).toBeGreaterThanOrEqual(0)
      expect(entrada.lane).toBeLessThan(LANES_POR_LADO)
    }
  })

  it('lados diferentes não disputam faixa', () => {
    // Um vindo da esquerda e um de cima podem usar a mesma faixa: pontos distintos.
    const doisLados: BotFlowGraph = {
      entryNodeId: 'esq',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'esq',
          kind: 'message',
          text: 'e',
          next: 'destino',
          position: { x: 0, y: 300 },
        },
        {
          id: 'cima',
          kind: 'message',
          text: 'c',
          next: 'destino',
          position: { x: 400, y: 0 },
        },
        {
          id: 'destino',
          kind: 'finish',
          text: 'fim',
          position: { x: 400, y: 300 },
        },
      ],
    }

    const lados = entrySides(doisLados)

    expect(lados.get('esq:next')?.side).toBe('left')
    expect(lados.get('cima:next')?.side).toBe('top')
    // Sozinho no seu lado, cada um fica no meio.
    const meio = Math.floor(LANES_POR_LADO / 2)
    expect(lados.get('esq:next')?.lane).toBe(meio)
    expect(lados.get('cima:next')?.lane).toBe(meio)
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
    const semLado = graphEdges(graph).filter(edge => !lados.get(edge.id)?.side)

    expect(semLado.map(edge => edge.id)).toEqual([])
  })
})
