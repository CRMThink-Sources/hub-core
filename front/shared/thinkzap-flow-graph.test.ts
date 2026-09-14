import { describe, expect, it } from 'vitest'
import type { BotFlowGraph, FlowNode } from './thinkzap-bot-flow'
import {
  clearPort,
  graphEdges,
  isPortRenameable,
  nodePorts,
  parsePortId,
  portId,
  setPortLabel,
  setPortTarget,
} from './thinkzap-flow-graph'
import { autoLayout, nextFreePosition } from './thinkzap-flow-layout'

const question: FlowNode = {
  id: 'n2',
  kind: 'question',
  text: 'qual?',
  options: [
    { label: 'A', value: 'opcao-1', next: 'n3' },
    { label: 'B', value: 'opcao-2', next: 'n4' },
  ],
  maxAttempts: 3,
  onExhausted: 'n4',
}

const graph: BotFlowGraph = {
  entryNodeId: 'n1',
  settings: { escapeKeywords: [], escapeTarget: null },
  nodes: [
    { id: 'n1', kind: 'message', text: 'oi', next: 'n2' },
    question,
    { id: 'n3', kind: 'finish', text: 'fim' },
    { id: 'n4', kind: 'handoff', target: { type: 'queue' } },
  ],
}

describe('portId / parsePortId', () => {
  it('ida e volta preserva a porta', () => {
    const portas = [
      { kind: 'next' as const },
      { kind: 'exhausted' as const },
      { kind: 'otherwise' as const },
      { kind: 'option' as const, index: 3 },
      { kind: 'branch' as const, index: 0 },
    ]

    for (const porta of portas) {
      expect(parsePortId(portId(porta))).toEqual(porta)
    }
  })

  it('id desconhecido não vira porta inventada', () => {
    expect(parsePortId('option:abc')).toBeNull()
    expect(parsePortId(null)).toBeNull()
  })
})

describe('nodePorts', () => {
  it('pergunta expõe uma porta por opção mais o desvio', () => {
    const ports = nodePorts(question)

    expect(ports.map(port => port.id)).toEqual([
      'option:0',
      'option:1',
      'exhausted',
    ])
    expect(ports[0]?.target).toBe('n3')
  })

  it('terminal não tem saída', () => {
    expect(nodePorts({ id: 'n3', kind: 'finish', text: 'fim' })).toEqual([])
  })

  it('opção sem rótulo mostra a posição em vez de vazio', () => {
    const semRotulo: FlowNode = {
      ...question,
      options: [{ label: '', value: 'opcao-1', next: 'n3' }],
    }

    expect(nodePorts(semRotulo)[0]?.label).toBe('Opção 1')
  })
})

describe('setPortTarget', () => {
  it('religa a opção certa e não toca nas outras', () => {
    const next = setPortTarget(question, { kind: 'option', index: 1 }, 'n3')

    expect(next.kind).toBe('question')
    if (next.kind !== 'question') throw new Error('tipo inesperado')
    expect(next.options[0]?.next).toBe('n3')
    expect(next.options[1]?.next).toBe('n3')
    expect(next.onExhausted).toBe('n4')
  })

  it('porta que não existe no nó devolve o nó intacto', () => {
    // Arrastar de um `finish` não pode inventar campo.
    const finish: FlowNode = { id: 'n3', kind: 'finish', text: 'fim' }
    expect(setPortTarget(finish, { kind: 'next' }, 'n1')).toBe(finish)

    expect(setPortTarget(question, { kind: 'otherwise' }, 'n1')).toBe(question)
  })

  it('índice fora da lista não cria opção nova', () => {
    const next = setPortTarget(question, { kind: 'option', index: 9 }, 'n1')

    if (next.kind !== 'question') throw new Error('tipo inesperado')
    expect(next.options).toHaveLength(2)
  })
})

describe('graphEdges', () => {
  it('uma aresta por porta ligada, com id estável', () => {
    const edges = graphEdges(graph)

    expect(edges.map(edge => edge.id)).toEqual([
      'n1:next',
      'n2:option:0',
      'n2:option:1',
      'n2:exhausted',
    ])
  })

  it('ignora aresta cujo destino não existe', () => {
    const quebrado: BotFlowGraph = {
      ...graph,
      nodes: [{ id: 'n1', kind: 'message', text: 'oi', next: 'fantasma' }],
    }

    expect(graphEdges(quebrado)).toEqual([])
  })
})

describe('autoLayout', () => {
  it('coloca cada bloco na coluna da sua distância até a entrada', () => {
    const layout = autoLayout(graph)

    expect(layout.get('n1')?.x).toBe(0)
    expect(layout.get('n2')?.x).toBeGreaterThan(layout.get('n1')!.x)
    // n3 e n4 saem de n2: mesma coluna, linhas diferentes.
    expect(layout.get('n3')?.x).toBe(layout.get('n4')?.x)
    expect(layout.get('n3')?.y).not.toBe(layout.get('n4')?.y)
  })

  it('nó inalcançável também recebe posição', () => {
    const comOrfao: BotFlowGraph = {
      ...graph,
      nodes: [...graph.nodes, { id: 'n9', kind: 'finish', text: 'solto' }],
    }

    expect(autoLayout(comOrfao).get('n9')).toBeDefined()
  })
})

describe('nextFreePosition', () => {
  it('não empilha bloco novo sobre bloco existente', () => {
    const comPos: BotFlowGraph = {
      ...graph,
      nodes: graph.nodes.map((node, index) => ({
        ...node,
        position: { x: 0, y: index * 100 },
      })),
    }

    const livre = nextFreePosition(comPos)
    const ocupadas = comPos.nodes.map(node => node.position!)

    expect(ocupadas.some(pos => pos.x === livre.x && pos.y === livre.y)).toBe(
      false,
    )
  })
})

describe('ir e voltar entre etapas', () => {
  /** menu → submenu → volta pro menu. Ciclo legítimo: espera resposta nas duas pontas. */
  const comVolta: BotFlowGraph = {
    entryNodeId: 'menu',
    settings: { escapeKeywords: [], escapeTarget: null },
    nodes: [
      {
        id: 'menu',
        kind: 'question',
        text: 'Menu',
        options: [
          { label: 'Vendas', value: 'v', next: 'sub' },
          { label: 'Sair', value: 's', next: 'fim' },
        ],
        maxAttempts: 3,
        onExhausted: 'fim',
      },
      {
        id: 'sub',
        kind: 'question',
        text: 'Vendas',
        options: [
          { label: 'Falar', value: 'f', next: 'fim' },
          { label: 'Voltar', value: 'b', next: 'menu' },
        ],
        maxAttempts: 3,
        onExhausted: 'fim',
      },
      { id: 'fim', kind: 'handoff', target: { type: 'queue' } },
    ],
  }

  it('a aresta de volta aparece no canvas', () => {
    const edges = graphEdges(comVolta)
    const volta = edges.find(edge => edge.id === 'sub:option:1')

    expect(volta?.target).toBe('menu')
  })

  it('ligar de volta para um bloco anterior não corrompe as outras saídas', () => {
    const sub = comVolta.nodes.find(node => node.id === 'sub')!
    const religado = setPortTarget(sub, { kind: 'option', index: 0 }, 'menu')

    if (religado.kind !== 'question') throw new Error('tipo inesperado')
    expect(religado.options[0]?.next).toBe('menu')
    expect(religado.options[1]?.next).toBe('menu')
    expect(religado.onExhausted).toBe('fim')
  })

  it('layout não empilha blocos de um ciclo na mesma posição', () => {
    const layout = autoLayout(comVolta)
    const chaves = [...layout.values()].map(pos => `${pos.x},${pos.y}`)

    expect(new Set(chaves).size).toBe(chaves.length)
  })
})

describe('fluxo grande', () => {
  it('cem blocos com aresta de volta viram cem posições distintas', () => {
    const nodes = Array.from({ length: 100 }, (_, i) =>
      i === 99
        ? {
            id: `n${i}`,
            kind: 'handoff' as const,
            target: { type: 'queue' as const },
          }
        : {
            id: `n${i}`,
            kind: 'question' as const,
            text: `P${i}`,
            options: [
              { label: 'a', value: 'a', next: `n${i + 1}` },
              { label: 'b', value: 'b', next: `n${Math.max(0, i - 1)}` },
            ],
            maxAttempts: 3,
            onExhausted: 'n99',
          },
    )
    const grande: BotFlowGraph = {
      entryNodeId: 'n0',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes,
    }

    const layout = autoLayout(grande)
    expect(layout.size).toBe(100)

    const chaves = [...layout.values()].map(pos => `${pos.x},${pos.y}`)
    expect(new Set(chaves).size).toBe(100)

    // Aresta de volta não vira aresta perdida.
    expect(graphEdges(grande).length).toBeGreaterThan(190)
  })
})

describe('ajustar e apagar ligação', () => {
  const base: BotFlowGraph = {
    entryNodeId: 'n1',
    settings: { escapeKeywords: [], escapeTarget: null },
    nodes: [
      { id: 'n1', kind: 'message', text: 'oi', next: 'n2' },
      question,
      { id: 'n3', kind: 'finish', text: 'fim' },
      { id: 'n4', kind: 'handoff', target: { type: 'queue' } },
    ],
  }

  /** Reconectar: a porta de origem é o campo do nó e não muda; o destino muda. */
  it('arrastar a ponta troca só o destino daquela porta', () => {
    const edge = graphEdges(base).find(e => e.id === 'n2:option:0')!
    const port = parsePortId(edge.sourceHandle)!

    const nodes = base.nodes.map(node =>
      node.id === edge.source ? setPortTarget(node, port, 'n4') : node,
    )
    const sub = nodes.find(node => node.id === 'n2')!
    if (sub.kind !== 'question') throw new Error('tipo inesperado')

    expect(sub.options[0]?.next).toBe('n4')
    expect(sub.options[1]?.next).toBe('n4')
    expect(sub.onExhausted).toBe('n4')
  })

  /**
   * Apagar uma saída fixa deixa a porta **pendente**, e é isso que permite religar.
   *
   * Antes ela reapontava para a entrada do fluxo: apagar A→B criava A→entrada, a porta
   * seguia ocupada e não havia como ligar A a nada de novo. Ver `clearPort`.
   */
  it('apagar saída fixa deixa a porta pendente', () => {
    const [source, ...resto] = 'n1:next'.split(':')
    const port = parsePortId(resto.join(':'))!

    const nodes = base.nodes.map(node =>
      node.id === source ? clearPort(node, port) : node,
    )
    const n1 = nodes.find(node => node.id === 'n1')!
    if (n1.kind !== 'message') throw new Error('tipo inesperado')

    expect(n1.next).toBe('n1')
  })

  /** Porta pendente não desenha aresta: ausência de ligação não é uma ligação. */
  it('a saída apagada não vira aresta no grafo', () => {
    const port = parsePortId('next')!
    const nodes = base.nodes.map(node =>
      node.id === 'n1' ? clearPort(node, port) : node,
    )

    const ids = graphEdges({ ...base, nodes }).map(edge => edge.id)
    expect(ids).not.toContain('n1:next')
  })

  /** Apagada e religada: é o ciclo que o usuário faz, e tinha de voltar a funcionar. */
  it('depois de apagar dá para ligar a saída em outro bloco', () => {
    const port = parsePortId('next')!
    const limpo = clearPort(base.nodes.find(node => node.id === 'n1')!, port)
    const religado = setPortTarget(limpo, port, 'n3')

    if (religado.kind !== 'message') throw new Error('tipo inesperado')
    expect(religado.next).toBe('n3')
  })

  it('o id da aresta sempre volta para origem + porta', () => {
    for (const edge of graphEdges(base)) {
      const [source, ...resto] = edge.id.split(':')

      expect(source).toBe(edge.source)
      expect(parsePortId(resto.join(':'))).not.toBeNull()
      expect(resto.join(':')).toBe(edge.sourceHandle)
    }
  })
})

describe('renomear rótulo da ligação', () => {
  it('renomear a opção muda o rótulo que a linha mostra', () => {
    const renomeado = setPortLabel(
      question,
      { kind: 'option', index: 0 },
      'Vendas',
    )

    if (renomeado.kind !== 'question') throw new Error('tipo inesperado')
    expect(renomeado.options[0]?.label).toBe('Vendas')
    // O valor não muda: é ele que a resposta do cliente casa.
    expect(renomeado.options[0]?.value).toBe('opcao-1')
    expect(renomeado.options[1]?.label).toBe('B')

    const edge = graphEdges({
      entryNodeId: 'n2',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        renomeado,
        { id: 'n3', kind: 'finish', text: 'f' },
        { id: 'n4', kind: 'handoff', target: { type: 'queue' } },
      ],
    }).find(e => e.id === 'n2:option:0')

    expect(edge?.label).toBe('Vendas')
  })

  it('porta sem campo por trás não é renomeável', () => {
    expect(isPortRenameable(question, { kind: 'option', index: 0 })).toBe(true)
    expect(isPortRenameable(question, { kind: 'exhausted' })).toBe(false)

    const msg: FlowNode = { id: 'n1', kind: 'message', text: 'oi', next: 'n2' }
    expect(isPortRenameable(msg, { kind: 'next' })).toBe(false)
    // E tentar renomear devolve o nó intacto, em vez de inventar campo.
    expect(setPortLabel(msg, { kind: 'next' }, 'x')).toBe(msg)
  })

  it('renomear condição altera a variável testada', () => {
    const cond: FlowNode = {
      id: 'c1',
      kind: 'condition',
      branches: [{ when: { var: 'nome', op: 'notEmpty' }, next: 'n3' }],
      otherwise: 'n4',
    }
    const renomeado = setPortLabel(cond, { kind: 'branch', index: 0 }, 'idade')

    if (renomeado.kind !== 'condition') throw new Error('tipo inesperado')
    expect(renomeado.branches[0]?.when.var).toBe('idade')
    expect(renomeado.branches[0]?.when.op).toBe('notEmpty')
  })
})

describe('bloco não liga em si mesmo', () => {
  it('setPortTarget recusa o próprio nó e devolve intacto', () => {
    expect(setPortTarget(question, { kind: 'option', index: 0 }, 'n2')).toBe(
      question,
    )
    expect(setPortTarget(question, { kind: 'exhausted' }, 'n2')).toBe(question)

    const msg: FlowNode = { id: 'n1', kind: 'message', text: 'oi', next: 'n2' }
    expect(setPortTarget(msg, { kind: 'next' }, 'n1')).toBe(msg)
  })

  it('ligar para outro bloco continua funcionando', () => {
    const next = setPortTarget(question, { kind: 'option', index: 0 }, 'n4')

    if (next.kind !== 'question') throw new Error('tipo inesperado')
    expect(next.options[0]?.next).toBe('n4')
  })
})

describe('clearPort', () => {
  it('apagar ligação de opção remove a opção', () => {
    const next = clearPort(question, { kind: 'option', index: 0 })

    if (next.kind !== 'question') throw new Error('tipo inesperado')
    expect(next.options).toHaveLength(1)
    expect(next.options[0]?.label).toBe('B')
  })

  it('não remove a última opção — pergunta sem opção não é respondível', () => {
    const uma: FlowNode = {
      ...question,
      options: [{ label: 'A', value: 'opcao-1', next: 'n3' }],
    }
    const next = clearPort(uma, { kind: 'option', index: 0 })

    if (next.kind !== 'question') throw new Error('tipo inesperado')
    expect(next.options).toHaveLength(1)
    // Fica pendente, apontando para o próprio bloco.
    expect(next.options[0]?.next).toBe(next.id)
  })

  it('saída fixa fica pendente em vez de desaparecer', () => {
    const msg: FlowNode = { id: 'n1', kind: 'message', text: 'oi', next: 'n2' }
    const next = clearPort(msg, { kind: 'next' })

    if (next.kind !== 'message') throw new Error('tipo inesperado')
    expect(next.next).toBe('n1')
  })

  it('apagar ramo de condição remove o ramo', () => {
    const cond: FlowNode = {
      id: 'c1',
      kind: 'condition',
      branches: [
        { when: { var: 'a', op: 'notEmpty' }, next: 'n3' },
        { when: { var: 'b', op: 'notEmpty' }, next: 'n4' },
      ],
      otherwise: 'n4',
    }
    const next = clearPort(cond, { kind: 'branch', index: 0 })

    if (next.kind !== 'condition') throw new Error('tipo inesperado')
    expect(next.branches).toHaveLength(1)
    expect(next.branches[0]?.when.var).toBe('b')
  })
})
