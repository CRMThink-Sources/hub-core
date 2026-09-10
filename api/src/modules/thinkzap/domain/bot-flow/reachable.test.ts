import { describe, expect, it } from 'vitest'
import type { BotFlowGraph, FlowNode } from './flow'
import { validateFlowGraph } from './flow.schema'

// Leque: todo bloco cai no mesmo fim. A fila antiga empilhava o destino comum uma vez
// por origem antes de descartar no `shift`.
function leque(quantidade: number): BotFlowGraph {
  const nodes: FlowNode[] = [
    {
      id: 'menu',
      kind: 'question',
      text: 'escolha',
      options: Array.from({ length: quantidade }, (_, i) => ({
        label: `op ${i}`,
        value: `opcao-${i}`,
        next: `m${i}`,
      })),
      maxAttempts: 2,
      onExhausted: 'fim',
    },
    { id: 'fim', kind: 'finish' },
  ]

  for (let i = 0; i < quantidade; i += 1) {
    nodes.push({
      id: `m${i}`,
      kind: 'message',
      text: `passo ${i}`,
      next: 'fim',
    })
  }

  return {
    entryNodeId: 'menu',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes,
  }
}

// Corrente: `MAX_QUESTION_OPTIONS` limita a largura, não o tamanho do fluxo.
function corrente(n: number): BotFlowGraph {
  const nodes: FlowNode[] = [{ id: 'fim', kind: 'finish' }]
  for (let i = 0; i < n; i += 1) {
    nodes.push({
      id: `m${i}`,
      kind: 'message',
      text: `passo ${i}`,
      next: i === n - 1 ? 'fim' : `m${i + 1}`,
    })
  }

  return {
    entryNodeId: 'm0',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes,
  }
}

describe('alcançabilidade', () => {
  it('destino compartilhado por muitas origens é alcançável uma vez', () => {
    expect(validateFlowGraph(leque(20))).toEqual([])
  })

  it('nó fora de qualquer caminho é apontado', () => {
    const graph = leque(3)
    graph.nodes.push({ id: 'orfao', kind: 'finish' })

    const issues = validateFlowGraph(graph)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('unreachable-node')
    expect(issues[0]?.nodeId).toBe('orfao')
  })

  it('ciclo pela re-pergunta não trava a varredura', () => {
    const graph = leque(2)
    // `m0` volta ao menu: o caminho passa por `question`, que é espera legítima.
    const m0 = graph.nodes.find(node => node.id === 'm0')
    if (m0?.kind === 'message') m0.next = 'menu'

    expect(validateFlowGraph(graph)).toEqual([])
  })

  // Sem teto em ms de propósito: o custo do `reachableFrom` antigo (33ms em 3000 nós,
  // contra ~1ms indexado) fica abafado pelo parse do zod, então um limite de tempo
  // passaria nas duas implementações.
  it('fluxo de 3000 blocos é validada inteira', () => {
    const graph = corrente(3000)

    expect(validateFlowGraph(graph)).toEqual([])
    // Nó solto no fim: prova que a varredura chegou até lá.
    graph.nodes.push({ id: 'orfao', kind: 'finish' })
    expect(validateFlowGraph(graph).map(issue => issue.nodeId)).toEqual([
      'orfao',
    ])
  })
})
