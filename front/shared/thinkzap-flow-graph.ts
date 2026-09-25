import type { BotFlowGraph, FlowNode, NodeId } from './thinkzap-bot-flow'

// Cada saída é uma porta com id estável, e é o id que diz qual campo do nó a aresta
// representa — senão o arrasto não saberia se mexeu na opção 2 ou no "ao desistir".

export type PortKind =
  | { kind: 'next' }
  | { kind: 'option'; index: number }
  | { kind: 'exhausted' }
  | { kind: 'branch'; index: number }
  | { kind: 'otherwise' }

/** `option:2`, `next`, `exhausted`… — id da porta no React Flow. */
export function portId(port: PortKind): string {
  switch (port.kind) {
    case 'next':
      return 'next'
    case 'exhausted':
      return 'exhausted'
    case 'otherwise':
      return 'otherwise'
    case 'option':
      return `option:${port.index}`
    case 'branch':
      return `branch:${port.index}`
  }
}

export function parsePortId(raw: string | null | undefined): PortKind | null {
  if (!raw) return null
  if (raw === 'next') return { kind: 'next' }
  if (raw === 'exhausted') return { kind: 'exhausted' }
  if (raw === 'otherwise') return { kind: 'otherwise' }

  const option = /^option:(\d+)$/.exec(raw)
  if (option) return { kind: 'option', index: Number(option[1]) }

  const branch = /^branch:(\d+)$/.exec(raw)
  if (branch) return { kind: 'branch', index: Number(branch[1]) }

  return null
}

export type FlowPort = {
  port: PortKind
  id: string
  /** O que aparece ao lado da porta. */
  label: string
  target: NodeId
}

/** Portas de um bloco, na ordem em que o bloco as desenha. */
export function nodePorts(node: FlowNode): FlowPort[] {
  switch (node.kind) {
    case 'message':
      return [
        { port: { kind: 'next' }, id: 'next', label: '', target: node.next },
      ]

    case 'question':
      return [
        ...node.options.map((option, index) => ({
          port: { kind: 'option' as const, index },
          id: portId({ kind: 'option', index }),
          label: option.label || `Opção ${index + 1}`,
          target: option.next,
        })),
        {
          port: { kind: 'exhausted' },
          id: 'exhausted',
          label: 'não entendeu',
          target: node.onExhausted,
        },
      ]

    case 'condition':
      return [
        ...node.branches.map((branch, index) => ({
          port: { kind: 'branch' as const, index },
          id: portId({ kind: 'branch', index }),
          label: branch.when.var || `Condição ${index + 1}`,
          target: branch.next,
        })),
        {
          port: { kind: 'otherwise' },
          id: 'otherwise',
          label: 'senão',
          target: node.otherwise,
        },
      ]

    case 'handoff':
    case 'finish':
      return []
  }
}

/**
 * Portas que o cartão desenha. A saída "não entendeu" da pergunta fica fora enquanto não
 * leva a ninguém: sem rótulo no cartão e sem campo no painel, ela se lia como uma opção a
 * mais do que a lista de opções. Ligada a um bloco ela volta, senão a aresta que já existe
 * perderia a bolinha de onde sai.
 */
export function visibleNodePorts(node: FlowNode): FlowPort[] {
  if (node.kind !== 'question') return nodePorts(node)

  return nodePorts(node).filter(
    porta => porta.port.kind !== 'exhausted' || porta.target !== node.id,
  )
}

/**
 * Reaponta uma porta. Porta inexistente devolve o nó intacto.
 *
 * Recusa `target === node.id`: apontar para si é a convenção de "pendente, sem destino".
 * Para desligar use `clearPort`.
 */
export function setPortTarget(
  node: FlowNode,
  port: PortKind,
  target: NodeId,
): FlowNode {
  if (target === node.id) return node

  return writePortTarget(node, port, target)
}

// Escreve sem julgar o valor: `clearPort` precisa gravar o próprio nó, que
// `setPortTarget` recusa.
function writePortTarget(
  node: FlowNode,
  port: PortKind,
  target: NodeId,
): FlowNode {
  switch (node.kind) {
    case 'message':
      return port.kind === 'next' ? { ...node, next: target } : node

    case 'question':
      if (port.kind === 'exhausted') return { ...node, onExhausted: target }
      if (port.kind === 'option') {
        return {
          ...node,
          options: node.options.map((option, index) =>
            index === port.index ? { ...option, next: target } : option,
          ),
        }
      }
      return node

    case 'condition':
      if (port.kind === 'otherwise') return { ...node, otherwise: target }
      if (port.kind === 'branch') {
        return {
          ...node,
          branches: node.branches.map((branch, index) =>
            index === port.index ? { ...branch, next: target } : branch,
          ),
        }
      }
      return node

    case 'handoff':
    case 'finish':
      return node
  }
}

/** Só `option` e `branch` têm rótulo editável; os fixos não teriam onde gravar. */
export function setPortLabel(
  node: FlowNode,
  port: PortKind,
  label: string,
): FlowNode {
  if (node.kind === 'question' && port.kind === 'option') {
    return {
      ...node,
      options: node.options.map((option, index) =>
        index === port.index ? { ...option, label } : option,
      ),
    }
  }

  if (node.kind === 'condition' && port.kind === 'branch') {
    return {
      ...node,
      branches: node.branches.map((branch, index) =>
        index === port.index
          ? { ...branch, when: { ...branch.when, var: label } }
          : branch,
      ),
    }
  }

  return node
}

/** `true` quando a porta tem rótulo vindo de campo do nó. */
export function isPortRenameable(node: FlowNode, port: PortKind): boolean {
  return (
    (node.kind === 'question' && port.kind === 'option') ||
    (node.kind === 'condition' && port.kind === 'branch')
  )
}

/**
 * Remove uma ligação. O schema exige um destino em toda saída, então "sem destino" é a
 * saída apontando para o próprio nó — a mesma convenção com que um bloco novo nasce.
 *
 * Em opção de pergunta e ramo de condição, apagar remove o item; a última só volta a
 * ficar pendente, porque pergunta sem opção não é respondível.
 */
export function clearPort(node: FlowNode, port: PortKind): FlowNode {
  if (node.kind === 'question' && port.kind === 'option') {
    if (node.options.length <= 1) return writePortTarget(node, port, node.id)
    return {
      ...node,
      options: node.options.filter((_, index) => index !== port.index),
    }
  }

  if (node.kind === 'condition' && port.kind === 'branch') {
    if (node.branches.length <= 1) return writePortTarget(node, port, node.id)
    return {
      ...node,
      branches: node.branches.filter((_, index) => index !== port.index),
    }
  }

  return writePortTarget(node, port, node.id)
}

export type FlowEdge = {
  id: string
  source: NodeId
  sourceHandle: string
  target: NodeId
  label: string
}

// Fora: destino inexistente (a lib avisa no console e o bloco já mostra o problema) e
// saída pendente, que desenhada virava um laço curto colado no cartão.
export function graphEdges(graph: BotFlowGraph): FlowEdge[] {
  const ids = new Set(graph.nodes.map(node => node.id))
  const edges: FlowEdge[] = []

  for (const node of graph.nodes) {
    for (const port of nodePorts(node)) {
      if (!ids.has(port.target)) continue
      if (port.target === node.id) continue
      edges.push({
        id: `${node.id}:${port.id}`,
        source: node.id,
        sourceHandle: port.id,
        target: port.target,
        label: port.label,
      })
    }
  }

  return edges
}
