import type { BotFlowGraph, FlowNodeKind, NodeId } from './thinkzap-bot-flow'
import { makeNode, nextNodeId } from './thinkzap-bot-flow'
import {
  nodePorts,
  portId,
  setPortTarget,
  type PortKind,
} from './thinkzap-flow-graph'
import { COLUMN_STEP, NODE_WIDTH } from './thinkzap-flow-layout'

/** Mesmo passo do `relayout`: com um próprio, `Reorganizar` deslocava tudo. */
const GAP_X = COLUMN_STEP
/** Só tolerância vertical de colisão — o crescimento é para o lado. */
const GAP_Y = 150

/**
 * Cria um bloco já ligado à saída que o pediu. Saída que já tinha destino insere no
 * meio: `A → C` vira `A → novo → C`, sem descartar C.
 */
export function insertAfter(
  graph: BotFlowGraph,
  sourceId: NodeId,
  port: PortKind,
  // Tipo cru ou fábrica: a receita pronta produz um nó do mesmo tipo, já preenchido.
  kindOuFabrica: FlowNodeKind | ((id: NodeId) => BotFlowGraph['nodes'][number]),
): { graph: BotFlowGraph; nodeId: NodeId } {
  const id = nextNodeId(graph)
  const origem = graph.nodes.find(node => node.id === sourceId)
  const base = origem?.position ?? { x: 0, y: 0 }

  const anterior = origem ? portTarget(origem, port) : undefined
  const herda =
    anterior && anterior !== sourceId && anterior !== id ? anterior : undefined

  const criado =
    typeof kindOuFabrica === 'function'
      ? kindOuFabrica(id)
      : makeNode(kindOuFabrica, id)

  let novo = {
    ...criado,
    position: livre(graph, { x: base.x + GAP_X, y: base.y }),
  }

  // A primeira saída do bloco novo continua a conversa de onde ela ia parar.
  if (herda) {
    const primeira = firstPort(novo)
    if (primeira) novo = { ...novo, ...setPortTarget(novo, primeira, herda) }
  }

  return {
    graph: {
      ...graph,
      nodes: [
        ...graph.nodes.map(node =>
          node.id === sourceId ? setPortTarget(node, port, id) : node,
        ),
        novo,
      ],
    },
    nodeId: id,
  }
}

/** Para onde uma porta aponta hoje. */
function portTarget(
  node: BotFlowGraph['nodes'][number],
  port: PortKind,
): NodeId | undefined {
  return nodePorts(node).find(candidata => candidata.id === portId(port))
    ?.target
}

/** Primeira saída do bloco, que é por onde a conversa segue. Terminal não tem. */
function firstPort(node: BotFlowGraph['nodes'][number]): PortKind | undefined {
  return nodePorts(node)[0]?.port
}

// Duas saídas do mesmo bloco pedem o mesmo ponto. Cresce na horizontal: empilhar para
// baixo transformava o fluxo numa coluna.
function livre(
  graph: BotFlowGraph,
  desejada: { x: number; y: number },
): { x: number; y: number } {
  const ocupadas = graph.nodes.map(node => node.position ?? { x: 0, y: 0 })
  let candidata = desejada

  while (
    ocupadas.some(
      posicao =>
        Math.abs(posicao.x - candidata.x) < NODE_WIDTH &&
        Math.abs(posicao.y - candidata.y) < GAP_Y,
    )
  ) {
    candidata = { x: candidata.x + GAP_X, y: candidata.y }
  }

  return candidata
}
