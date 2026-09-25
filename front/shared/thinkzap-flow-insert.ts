import type { BotFlowGraph, FlowNodeKind, NodeId } from './thinkzap-bot-flow'
import { makeNode, nextNodeId } from './thinkzap-bot-flow'
import {
  nodePorts,
  portId,
  setPortTarget,
  type PortKind,
} from './thinkzap-flow-graph'
import {
  COLUMN_STEP,
  NODE_WIDTH,
  ROW_GAP,
  nodeHeight,
  portOffsetY,
  topFromCenter,
} from './thinkzap-flow-layout'

/** Mesmo passo do `relayout`: com um próprio, `Reorganizar` deslocava tudo. */
const GAP_X = COLUMN_STEP
/** Folga mínima entre dois cartões da mesma coluna. */
const GAP_Y = ROW_GAP
/** Quantos desvios verticais antes de desistir da coluna e ir para a próxima. */
const MAX_DESVIOS = 8

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

  // Centro alinhado à bolinha que o pediu, senão o traço sai em degrau.
  const centro = origem
    ? base.y + portOffsetY(origem, portId(port))
    : base.y + nodeHeight(criado) / 2

  // Inserção no meio precisa de coluna vaga entre os dois.
  const comEspaco = herda
    ? abrirColuna(graph, sourceId, base.x + GAP_X, herda)
    : graph

  let novo = {
    ...criado,
    position: freePosition(comEspaco, criado, {
      x: base.x + GAP_X,
      y: topFromCenter(criado, centro),
    }),
  }

  // A primeira saída do bloco novo continua a conversa de onde ela ia parar.
  if (herda) {
    const primeira = firstPort(novo)
    if (primeira) novo = { ...novo, ...setPortTarget(novo, primeira, herda) }
  }

  return {
    graph: {
      ...comEspaco,
      nodes: [
        ...comEspaco.nodes.map(node =>
          node.id === sourceId ? setPortTarget(node, port, id) : node,
        ),
        novo,
      ],
    },
    nodeId: id,
  }
}

/** Empurra o que está de `coluna` em diante. Só age se o destino estiver perto demais. */
function abrirColuna(
  graph: BotFlowGraph,
  sourceId: NodeId,
  coluna: number,
  destino: NodeId,
): BotFlowGraph {
  const alvo = graph.nodes.find(node => node.id === destino)?.position
  if (!alvo || alvo.x >= coluna + GAP_X) return graph

  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const position = node.position
      if (!position || node.id === sourceId || position.x < coluna) return node
      return { ...node, position: { ...position, x: position.x + GAP_X } }
    }),
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

/**
 * Lugar vago mais próximo do pedido. Desvia na própria coluna, não para a direita: o
 * irmão empurrado para a coluna seguinte fazia a aresta cruzar o bloco do meio.
 */
function freePosition(
  graph: BotFlowGraph,
  node: BotFlowGraph['nodes'][number],
  desejada: { x: number; y: number },
): { x: number; y: number } {
  const altura = nodeHeight(node)
  const ocupadas = graph.nodes.map(outro => ({
    position: outro.position ?? { x: 0, y: 0 },
    altura: nodeHeight(outro),
  }))

  const colide = (candidata: { x: number; y: number }) =>
    ocupadas.some(
      ocupada =>
        Math.abs(ocupada.position.x - candidata.x) < NODE_WIDTH &&
        // Retângulos reais: distância entre topos ignorava alturas diferentes.
        candidata.y < ocupada.position.y + ocupada.altura + GAP_Y &&
        ocupada.position.y < candidata.y + altura + GAP_Y,
    )

  let x = desejada.x

  for (let coluna = 0; ; coluna += 1, x += GAP_X) {
    for (let desvio = 0; desvio <= MAX_DESVIOS; desvio += 1) {
      // 0, +1, -1, +2, -2… — para baixo primeiro, na ordem em que as saídas se leem.
      const volta =
        desvio === 0 ? 0 : Math.ceil(desvio / 2) * (desvio % 2 === 1 ? 1 : -1)
      const candidata = { x, y: desejada.y + volta * (altura + GAP_Y) }
      if (!colide(candidata)) return candidata
    }
  }
}
