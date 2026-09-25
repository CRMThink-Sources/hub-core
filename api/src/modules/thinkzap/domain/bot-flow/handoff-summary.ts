import { type BotFlowGraph, type FlowNode, type NodeId } from './flow'
import { CAPTURE_NAMESPACE, CHOICE_NAMESPACE } from './vars'

/**
 * Resumo do que o bot já apurou, sussurrado ao operador no handoff.
 *
 * Sai de `vars` e não do grafo porque só `vars` sabe por onde a conversa passou de fato:
 * ramo não tomado e pergunta não respondida não deixam chave. A ordem das chaves é a de
 * escrita, então a lista sai na ordem da conversa.
 *
 * Duas origens, porque o cliente responde de dois jeitos: `capture.*` é o que ele
 * digitou, `choice.*` é o menu que ele escolheu numa pergunta sem captura.
 */

const TITULO = 'Resumo do atendimento automático'
const SEM_RESPOSTAS = 'O cliente não respondeu nada antes da transferência.'

/** Teto por resposta: o sussurro é contexto de relance, não transcrição. */
const LIMITE_RESPOSTA = 200

function encurta(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, ' ')
  return limpo.length > LIMITE_RESPOSTA
    ? `${limpo.slice(0, LIMITE_RESPOSTA)}…`
    : limpo
}

type CapturingNode = Extract<FlowNode, { kind: 'message' | 'question' }>

function captura(node: FlowNode): node is CapturingNode {
  return node.kind === 'message' || node.kind === 'question'
}

/** Nome do bloco, com a fala dele como reserva: o operador precisa saber o que foi perguntado. */
function rotuloDoNode(
  node: CapturingNode | undefined,
  reserva: string,
): string {
  if (!node) return reserva
  return node.name?.trim() || encurta(node.text)
}

function porCaptura(graph: BotFlowGraph, capture: string): string {
  const node = graph.nodes
    .filter(captura)
    .find(item => item.capture?.trim() === capture)

  return rotuloDoNode(node, capture)
}

function porNodeId(graph: BotFlowGraph, nodeId: NodeId): string {
  const node = graph.nodes.filter(captura).find(item => item.id === nodeId)
  return rotuloDoNode(node, nodeId)
}

const CAPTURE_PREFIXO = `${CAPTURE_NAMESPACE}.`
const CHOICE_PREFIXO = `${CHOICE_NAMESPACE}.`

function rotulo(graph: BotFlowGraph, chave: string): string | null {
  if (chave.startsWith(CAPTURE_PREFIXO)) {
    return porCaptura(graph, chave.slice(CAPTURE_PREFIXO.length))
  }

  if (chave.startsWith(CHOICE_PREFIXO)) {
    return porNodeId(graph, chave.slice(CHOICE_PREFIXO.length))
  }

  // `bitrix.*` fica de fora: o operador já vê o contato no topo da conversa.
  return null
}

export function handoffSummary(
  graph: BotFlowGraph,
  vars: Record<string, string>,
): string {
  const linhas = Object.entries(vars).flatMap(([chave, valor]) => {
    if (!valor.trim()) return []

    const nome = rotulo(graph, chave)
    return nome ? [`• ${nome}: ${encurta(valor)}`] : []
  })

  return [TITULO, '', ...(linhas.length ? linhas : [SEM_RESPOSTAS])].join('\n')
}
