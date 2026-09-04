import type { BotFlowGraph } from './thinkzap-bot-flow'
import { graphEdges } from './thinkzap-flow-graph'
import { entrySides, inHandleId } from './thinkzap-flow-sides'

/** Aresta do canvas, sem nada de React. */
export type CanvasEdge = {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
  label: string
}

/**
 * Arestas que o canvas desenha.
 *
 * Puro de propósito: a lib compara aresta por referência, e recriar objeto sem
 * necessidade faz ela emitir `replace` para todas e descartar a seleção.
 */
export function canvasEdges(graph: BotFlowGraph): CanvasEdge[] {
  const lados = entrySides(graph)

  return graphEdges(graph).map(edge => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: inHandleId(lados.get(edge.id) ?? 'left'),
    label: edge.label,
  }))
}

/** Chave que muda só quando o desenho das arestas muda de verdade. */
export function edgesKey(graph: BotFlowGraph): string {
  return canvasEdges(graph)
    .map(edge => `${edge.id}>${edge.target}@${edge.targetHandle}|${edge.label}`)
    .join(';')
}
