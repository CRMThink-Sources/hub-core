import type { BotFlowGraph, NodeId, NodePosition } from './thinkzap-bot-flow'
import { nodeOutgoing } from './thinkzap-bot-flow'

/** Cartão em repouso; cresce com muitas saídas. */
export const NODE_WIDTH = 208
export const NODE_HEIGHT = 120
/** Coluna estreita faz o traço passar por cima do bloco vizinho. */
const COLUMN_GAP = 140
/** Exportado: o `+` cria bloco com este passo, senão `Reorganizar` deslocava tudo. */
export const COLUMN_STEP = NODE_WIDTH + COLUMN_GAP
const ROW_GAP = 72
const ROW_HEIGHT = NODE_HEIGHT

/** Índice por id: as varreduras faziam `find`/`some` por nó, o que era O(n²). */
function indexById(
  graph: BotFlowGraph,
): Map<NodeId, BotFlowGraph['nodes'][number]> {
  return new Map(graph.nodes.map(node => [node.id, node]))
}

/** Posição de cada bloco em camadas: a camada é a distância até a entrada. */
export function autoLayout(graph: BotFlowGraph): Map<NodeId, NodePosition> {
  const porId = indexById(graph)
  const depth = new Map<NodeId, number>()
  const queue: NodeId[] = []

  if (porId.has(graph.entryNodeId)) {
    depth.set(graph.entryNodeId, 0)
    queue.push(graph.entryNodeId)
  }

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    const node = porId.get(current)
    if (!node) continue

    for (const target of nodeOutgoing(node)) {
      if (depth.has(target) || !porId.has(target)) continue
      depth.set(target, (depth.get(current) ?? 0) + 1)
      queue.push(target)
    }
  }

  // Nó inalcançável ainda precisa de lugar: vai para a coluna seguinte à última.
  const maxDepth = Math.max(-1, ...depth.values())
  for (const node of graph.nodes) {
    if (!depth.has(node.id)) depth.set(node.id, maxDepth + 1)
  }

  const byColumn = new Map<number, NodeId[]>()
  for (const node of graph.nodes) {
    const column = depth.get(node.id) ?? 0
    const coluna = byColumn.get(column)
    if (coluna) coluna.push(node.id)
    else byColumn.set(column, [node.id])
  }

  const positions = new Map<NodeId, NodePosition>()
  for (const [column, ids] of byColumn) {
    ids.forEach((id, row) => {
      positions.set(id, {
        x: column * COLUMN_STEP,
        y: row * (ROW_HEIGHT + ROW_GAP),
      })
    })
  }

  return positions
}

/** Preenche o que falta sem mexer em quem já tem coordenada salva. */
export function withPositions(graph: BotFlowGraph): BotFlowGraph {
  if (graph.nodes.every(node => node.position)) return graph

  const layout = autoLayout(graph)

  return {
    ...graph,
    nodes: graph.nodes.map(node => ({
      ...node,
      position: node.position ?? layout.get(node.id) ?? { x: 0, y: 0 },
    })),
  }
}

/** Bloco novo abre em coluna nova à direita: crescer para baixo virava coluna. */
export function nextFreePosition(graph: BotFlowGraph): NodePosition {
  if (graph.nodes.length === 0) return { x: 0, y: 0 }

  const posicoes = graph.nodes.map(node => node.position ?? { x: 0, y: 0 })
  const x = Math.max(...posicoes.map(p => p.x))
  const doTopo = posicoes.filter(p => p.x === x)
  const y = Math.min(...doTopo.map(p => p.y))

  return { x: x + COLUMN_STEP, y }
}

/** Recalcula a posição de todos os blocos, descartando o arranjo atual. */
export function relayout(graph: BotFlowGraph): BotFlowGraph {
  const layout = autoLayout(graph)

  return {
    ...graph,
    nodes: graph.nodes.map(node => ({
      ...node,
      position: layout.get(node.id) ?? node.position ?? { x: 0, y: 0 },
    })),
  }
}

/**
 * A entrada é 1, daí na ordem em que a conversa alcança cada bloco (não a de criação).
 * Inalcançável vai para o fim.
 */
export function readingOrder(graph: BotFlowGraph): Map<NodeId, number> {
  const porId = indexById(graph)
  const visto = new Set<NodeId>()
  const ordenados: NodeId[] = []

  if (porId.has(graph.entryNodeId)) {
    ordenados.push(graph.entryNodeId)
    visto.add(graph.entryNodeId)
  }

  // `ordenados` é a própria fila: a ordem da BFS já é a ordem de leitura.
  for (let i = 0; i < ordenados.length; i++) {
    const node = porId.get(ordenados[i])
    if (!node) continue

    for (const target of nodeOutgoing(node)) {
      if (visto.has(target) || !porId.has(target)) continue
      visto.add(target)
      ordenados.push(target)
    }
  }

  // `visto` também no fim: id repetido no array entraria duas vezes e roubaria um número.
  for (const node of graph.nodes) {
    if (visto.has(node.id)) continue
    visto.add(node.id)
    ordenados.push(node.id)
  }

  return new Map(ordenados.map((id, index) => [id, index + 1]))
}
