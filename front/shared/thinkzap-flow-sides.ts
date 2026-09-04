import type { BotFlowGraph, NodeId, NodePosition } from './thinkzap-bot-flow'
import { nodePorts } from './thinkzap-flow-graph'
import { NODE_HEIGHT, NODE_WIDTH } from './thinkzap-flow-layout'

// O React Flow, sem handle nomeado, ancora a linha no primeiro handle que encontra —
// sempre no mesmo pixel. Aqui o lado da entrada sai da geometria. Nada é salvo, então
// fluxo antigo já abre com o comportamento novo.

export type Side = 'left' | 'right' | 'top' | 'bottom'

/** `in:left`, `in:top`… — id do handle de entrada por lado. */
export function inHandleId(side: Side): string {
  return `in:${side}`
}

export const SIDES: Side[] = ['left', 'right', 'top', 'bottom']

/**
 * Deslocamentos normalizados pelo formato do cartão — sem normalizar, quase tudo cairia
 * como horizontal. Empate favorece o horizontal, que é como se lê o fluxo.
 */
export function entrySide(from: NodePosition, to: NodePosition): Side {
  const dx = from.x - to.x
  const dy = from.y - to.y

  if (Math.abs(dx) / NODE_WIDTH >= Math.abs(dy) / NODE_HEIGHT) {
    return dx >= 0 ? 'right' : 'left'
  }

  return dy >= 0 ? 'bottom' : 'top'
}

/**
 * Indexado por `${source}:${portId}`. Bloco sem posição usa a origem: até o layout rodar
 * não há geometria.
 */
export function entrySides(graph: BotFlowGraph): Map<string, Side> {
  const posicoes = new Map<NodeId, NodePosition>(
    graph.nodes.map(node => [node.id, node.position ?? { x: 0, y: 0 }]),
  )

  const lados = new Map<string, Side>()

  for (const node of graph.nodes) {
    const from = posicoes.get(node.id)
    if (!from) continue

    for (const port of nodePorts(node)) {
      const to = posicoes.get(port.target)
      if (!to) continue
      lados.set(`${node.id}:${port.id}`, entrySide(from, to))
    }
  }

  return lados
}
