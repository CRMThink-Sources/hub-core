import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './thinkzap-bot-flow'
import { insertAfter } from './thinkzap-flow-insert'
import { canvasEdges } from './thinkzap-flow-edges'
import { nodePorts } from './thinkzap-flow-graph'

const base = (): BotFlowGraph => ({
  entryNodeId: 'n1',
  settings: { escapeKeywords: [], escapeNext: null },
  nodes: [
    {
      id: 'n1',
      kind: 'question',
      text: 'qual?',
      maxAttempts: 3,
      // Ambas pendentes, como um bloco novo nasce.
      options: [{ label: 'a', value: 'opcao-1', next: 'n1' }],
      onExhausted: 'n1',
      position: { x: 0, y: 0 },
    },
  ],
})

describe('insertAfter', () => {
  it('liga a saída ao bloco novo', () => {
    const { graph, nodeId } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    const origem = graph.nodes.find(node => node.id === 'n1')!
    const porta = nodePorts(origem).find(port => port.id === 'option:0')

    expect(nodeId).toBe('n2')
    expect(porta?.target).toBe('n2')
  })

  it('a ligação aparece no canvas na hora', () => {
    // O ponto do fluxo: bloco criado pelo + já vem ligado, sem arrastar nada.
    const { graph } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    expect(canvasEdges(graph).map(edge => edge.id)).toEqual(['n1:option:0'])
  })

  it('não mexe nas outras saídas', () => {
    const { graph } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    const origem = graph.nodes.find(node => node.id === 'n1')!
    const esgotou = nodePorts(origem).find(port => port.id === 'exhausted')

    // Segue pendente: só a saída pedida foi ligada.
    expect(esgotou?.target).toBe('n1')
  })

  it('o bloco novo nasce à direita da origem', () => {
    const { graph, nodeId } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    expect(novo.position!.x).toBeGreaterThan(0)
    expect(novo.position!.y).toBe(0)
  })

  it('duas saídas do mesmo bloco não empilham blocos', () => {
    const primeiro = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )
    const segundo = insertAfter(
      primeiro.graph,
      'n1',
      { kind: 'exhausted' },
      'handoff',
    )

    const a = segundo.graph.nodes.find(n => n.id === primeiro.nodeId)!
    const b = segundo.graph.nodes.find(n => n.id === segundo.nodeId)!

    expect(b.position).not.toEqual(a.position)
  })

  it('a segunda saída desvia para o lado, não para baixo', () => {
    // Fluxo se lê da esquerda para a direita: empilhar para baixo virava coluna.
    const primeiro = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )
    const segundo = insertAfter(
      primeiro.graph,
      'n1',
      { kind: 'exhausted' },
      'handoff',
    )

    const a = segundo.graph.nodes.find(n => n.id === primeiro.nodeId)!
    const b = segundo.graph.nodes.find(n => n.id === segundo.nodeId)!

    expect(b.position!.y).toBe(a.position!.y)
    expect(b.position!.x).toBeGreaterThan(a.position!.x)
  })

  it('bloco terminal criado pelo + não fica pendente', () => {
    const { graph, nodeId } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'finish',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    expect(nodePorts(novo)).toEqual([])
  })

  it('bloco novo com saída própria nasce pendente', () => {
    const { graph, nodeId } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    // Aponta para si: pendente, e por isso não desenha laço no canvas.
    expect(nodePorts(novo)[0]?.target).toBe(nodeId)
    expect(canvasEdges(graph).some(edge => edge.source === nodeId)).toBe(false)
  })

  it('origem inexistente não quebra', () => {
    expect(() =>
      insertAfter(base(), 'sumiu', { kind: 'next' }, 'message'),
    ).not.toThrow()
  })
})

describe('insertAfter em saída já ligada', () => {
  /**
   * Fluxo com tudo ligado não tinha nenhum `+` na tela: o `+` só aparecia em saída
   * pendente, e sem barra de "adicionar bloco" não havia como crescer o fluxo. O `+` da
   * saída ligada insere **no meio** — o bloco novo assume o destino que estava lá.
   */
  const ligado = (): BotFlowGraph => ({
    entryNodeId: 'a',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes: [
      {
        id: 'a',
        kind: 'message',
        text: 'primeiro',
        next: 'c',
        position: { x: 0, y: 0 },
      },
      { id: 'c', kind: 'finish', text: 'fim', position: { x: 400, y: 0 } },
    ],
  })

  it('A → C vira A → novo → C', () => {
    const { graph, nodeId } = insertAfter(
      ligado(),
      'a',
      { kind: 'next' },
      'message',
    )

    const a = graph.nodes.find(node => node.id === 'a')!
    const novo = graph.nodes.find(node => node.id === nodeId)!

    expect(a.kind === 'message' && a.next).toBe(nodeId)
    expect(novo.kind === 'message' && novo.next).toBe('c')
  })

  it('o destino antigo não é descartado', () => {
    const { graph } = insertAfter(ligado(), 'a', { kind: 'next' }, 'message')

    // 'c' segue no grafo e segue alcançável.
    expect(graph.nodes.some(node => node.id === 'c')).toBe(true)
    expect(canvasEdges(graph).some(edge => edge.target === 'c')).toBe(true)
  })

  it('as duas ligações aparecem no canvas', () => {
    const { graph, nodeId } = insertAfter(
      ligado(),
      'a',
      { kind: 'next' },
      'message',
    )

    const alvos = canvasEdges(graph).map(
      edge => `${edge.source}->${edge.target}`,
    )
    expect(alvos).toContain(`a->${nodeId}`)
    expect(alvos).toContain(`${nodeId}->c`)
  })

  it('bloco terminal inserido no meio não herda destino', () => {
    // `finish` não tem saída: o destino antigo fica órfão, e isso é escolha do usuário.
    const { graph, nodeId } = insertAfter(
      ligado(),
      'a',
      { kind: 'next' },
      'finish',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    expect(nodePorts(novo)).toEqual([])
    expect(canvasEdges(graph).map(edge => edge.id)).toEqual(['a:next'])
  })

  it('pergunta inserida no meio herda o destino na primeira opção', () => {
    const { graph, nodeId } = insertAfter(
      ligado(),
      'a',
      { kind: 'next' },
      'question',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    if (novo.kind !== 'question') throw new Error('tipo errado')

    expect(novo.options[0]?.next).toBe('c')
    // O esgotamento segue pendente: só a primeira saída continua a conversa.
    expect(novo.onExhausted).toBe(nodeId)
  })

  it('saída pendente continua não herdando nada', () => {
    const { graph, nodeId } = insertAfter(
      base(),
      'n1',
      { kind: 'option', index: 0 },
      'message',
    )

    const novo = graph.nodes.find(node => node.id === nodeId)!
    // Sem destino anterior para herdar: nasce pendente.
    expect(novo.kind === 'message' && novo.next).toBe(nodeId)
  })
})
