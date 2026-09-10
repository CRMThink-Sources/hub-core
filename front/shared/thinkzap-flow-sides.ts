import type { BotFlowGraph, NodeId, NodePosition } from './thinkzap-bot-flow'
import { nodePorts } from './thinkzap-flow-graph'
import { NODE_HEIGHT, NODE_WIDTH } from './thinkzap-flow-layout'

// O React Flow, sem handle nomeado, ancora a linha no primeiro handle que encontra —
// sempre no mesmo pixel. Aqui o lado da entrada sai da geometria. Nada é salvo, então
// fluxo antigo já abre com o comportamento novo.

export type Side = 'left' | 'right' | 'top' | 'bottom'

/**
 * Quantos pontos de chegada cada lado oferece.
 *
 * Um só por lado fazia toda aresta que entra pela esquerda terminar no mesmo pixel: com
 * dois ou mais blocos ligando no mesmo destino, os traços ficavam exatamente sobrepostos
 * — e `Reorganizar` não resolvia, porque o problema é o ponto de chegada, não a posição
 * dos cartões.
 */
export const LANES_POR_LADO = 3

/** `in:left:0`, `in:top:2`… — id do handle de entrada por lado e faixa. */
export function inHandleId(side: Side, lane = 0): string {
  return `in:${side}:${lane}`
}

export const SIDES: Side[] = ['left', 'right', 'top', 'bottom']

/** As faixas de um lado, para o bloco desenhar um handle por faixa. */
export const LANES: number[] = Array.from(
  { length: LANES_POR_LADO },
  (_, i) => i,
)

/**
 * Onde a faixa fica no lado, de `0` (início) a `1` (fim).
 *
 * Faixa única cai no meio; com três, as posições são 25%, 50% e 75% — a do meio é a que
 * a aresta usa quando é a única, então o caso comum continua entrando pelo centro.
 */
export function lanePercent(lane: number): number {
  return (lane + 1) / (LANES_POR_LADO + 1)
}

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

/** Lado de chegada e a faixa dentro dele. */
export type Entry = { side: Side; lane: number }

/**
 * Indexado por `${source}:${portId}`. Bloco sem posição usa a origem: até o layout rodar
 * não há geometria.
 *
 * Além do lado, distribui em faixas quem chega no mesmo lado do mesmo destino — é o que
 * separa traços que antes terminavam no mesmo ponto.
 */
export function entrySides(graph: BotFlowGraph): Map<string, Entry> {
  const posicoes = new Map<NodeId, NodePosition>(
    graph.nodes.map(node => [node.id, node.position ?? { x: 0, y: 0 }]),
  )

  type Chegada = { chave: string; side: Side; from: NodePosition }
  /** Agrupado por `destino|lado`: a faixa só importa entre quem disputa o mesmo lado. */
  const porDestinoLado = new Map<string, Chegada[]>()

  for (const node of graph.nodes) {
    const from = posicoes.get(node.id)
    if (!from) continue

    for (const port of nodePorts(node)) {
      const to = posicoes.get(port.target)
      if (!to) continue

      const side = entrySide(from, to)
      const grupo = `${port.target}|${side}`
      const lista = porDestinoLado.get(grupo)
      const chegada = { chave: `${node.id}:${port.id}`, side, from }

      if (lista) lista.push(chegada)
      else porDestinoLado.set(grupo, [chegada])
    }
  }

  const entradas = new Map<string, Entry>()

  for (const chegadas of porDestinoLado.values()) {
    // Uma só: faixa do meio, que é o comportamento de antes.
    if (chegadas.length === 1) {
      const unica = chegadas[0]
      entradas.set(unica.chave, {
        side: unica.side,
        lane: Math.floor(LANES_POR_LADO / 2),
      })
      continue
    }

    // Ordena por onde a origem está: quem vem de cima entra pela faixa de cima, e os
    // traços não se cruzam para alcançar a faixa.
    const eixo = chegadas[0].side === 'top' || chegadas[0].side === 'bottom'
    const ordenadas = [...chegadas].sort((a, b) =>
      eixo ? a.from.x - b.from.x : a.from.y - b.from.y,
    )

    ordenadas.forEach((chegada, indice) => {
      entradas.set(chegada.chave, {
        // Mais chegadas que faixas: as excedentes repetem a última em vez de sair do
        // cartão. Sobreposição volta só nesse caso, que é raro.
        side: chegada.side,
        lane: Math.min(indice, LANES_POR_LADO - 1),
      })
    })
  }

  return entradas
}
