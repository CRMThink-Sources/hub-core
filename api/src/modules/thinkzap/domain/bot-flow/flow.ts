// Grafo, não árvore: destino é id, então dois ramos podem cair no mesmo nó em vez de
// duplicar o trecho.

export type NodeId = string

/** Nome de variável da sessão, onde a captura guarda a resposta. */
export type VarName = string

export type InputValidation = 'text' | 'email' | 'cpf' | 'number' | 'date'

/** Só organização — o cliente nunca vê. */
export type NodeName = string

/** Ausente = editor calcula o layout. */
export type NodePosition = { x: number; y: number }

/**
 * De que lado cada saída sai, por id de porta (`next`, `option:0`…). Só desenho; ausente
 * significa "pela direita". Vive no nó porque a saída é o campo `next`, um id puro.
 */
export type PortSides = Record<string, 'right' | 'bottom'>

/** Fala e segue. Não espera resposta. */
export type MessageNode = {
  id: NodeId
  kind: 'message'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  next: NodeId
}

export type QuestionOption = {
  /** É o que vai para `saveAs`; o rótulo é só o que o cliente lê. */
  value: string
  label: string
  /**
   * Outras respostas que levam a esta opção.
   *
   * O rótulo é o que aparece na mensagem, e ninguém digita exatamente ele: o cliente
   * responde "ajuda", "problema", "um". Sem esta lista, tudo isso caía em
   * `onExhausted` — e o operador não tinha como ensinar o bot, porque o rótulo é o
   * texto exibido e mudá-lo mudaria a mensagem.
   */
  aliases?: string[]
  next: NodeId
}

/** Fala as opções e espera. */
export type QuestionNode = {
  id: NodeId
  kind: 'question'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  options: QuestionOption[]
  saveAs?: VarName
  /** Texto da re-pergunta. Ausente = repete `text`. */
  retryText?: string
  /** Respostas fora das opções toleradas antes de desviar. */
  maxAttempts: number
  onExhausted: NodeId
}

/** Espera texto livre, valida e guarda. */
export type InputNode = {
  id: NodeId
  kind: 'input'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  saveAs: VarName
  validate: InputValidation
  retryText?: string
  next: NodeId
  maxAttempts: number
  onExhausted: NodeId
}

export type VarOperator = 'eq' | 'neq' | 'contains' | 'empty' | 'notEmpty'

export type VarTest = {
  var: VarName
  op: VarOperator
  /** Ignorado por `empty` e `notEmpty`. */
  value?: string
}

/** Ramifica pelo que já está nas variáveis. Não fala. */
export type ConditionNode = {
  id: NodeId
  kind: 'condition'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  branches: Array<{ when: VarTest; next: NodeId }>
  otherwise: NodeId
}

export type HandoffTarget =
  | { type: 'queue' }
  | { type: 'user'; bitrixUserId: string }
  | { type: 'line'; lineId: string }

/** Entrega para humano. Termina a participação do bot. */
export type HandoffNode = {
  id: NodeId
  kind: 'handoff'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  /** Última fala antes de entregar. Ausente = entrega calada. */
  text?: string
  target: HandoffTarget
}

/** Encerra a sessão do canal aberto. */
export type FinishNode = {
  id: NodeId
  kind: 'finish'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text?: string
}

export type FlowNode =
  | MessageNode
  | QuestionNode
  | InputNode
  | ConditionNode
  | HandoffNode
  | FinishNode

/** Nós que terminam a participação do bot — não têm destino. */
export type TerminalNode = HandoffNode | FinishNode

/** Nós que param e esperam o cliente. */
export type WaitingNode = QuestionNode | InputNode

export type FlowSettings = {
  /** Vale em qualquer ponto do fluxo. `escapeTarget: null` desliga a saída de emergência. */
  escapeKeywords: string[]
  /** Para quem a conversa vai quando a palavra aparece. Não é um bloco: o bot sai na hora. */
  escapeTarget: HandoffTarget | null
  /** Última fala antes de transferir. Ausente = transferência calada. */
  escapeText?: string
}

export type BotFlowGraph = {
  entryNodeId: NodeId
  nodes: FlowNode[]
  settings: FlowSettings
}

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
  // Vazio de propósito: palavra sugerida virava regra que ninguém pediu — "atendente"
  // cortava o fluxo no primeiro cliente que escrevesse a palavra sem querer sair dele.
  escapeKeywords: [],
  escapeTarget: null,
}

export const isTerminal = (node: FlowNode): node is TerminalNode =>
  node.kind === 'handoff' || node.kind === 'finish'

export const isWaiting = (node: FlowNode): node is WaitingNode =>
  node.kind === 'question' || node.kind === 'input'

/** Destinos de um nó. Terminal não tem nenhum. */
export function outgoing(node: FlowNode): NodeId[] {
  switch (node.kind) {
    case 'message':
      return [node.next]
    case 'question':
      return [...node.options.map(option => option.next), node.onExhausted]
    case 'input':
      return [node.next, node.onExhausted]
    case 'condition':
      return [...node.branches.map(branch => branch.next), node.otherwise]
    case 'handoff':
    case 'finish':
      return []
  }
}

export function findNode(
  graph: BotFlowGraph,
  nodeId: NodeId,
): FlowNode | undefined {
  return graph.nodes.find(node => node.id === nodeId)
}
