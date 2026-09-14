// Espelho de `api/src/modules/thinkzap/domain/bot-flow/flow.ts`. Duplicado porque são
// pacotes separados; o `botFlowGraphSchema` do servidor recusa o que divergir.

export type NodeId = string

/** Espelha `MAX_QUESTION_OPTIONS` do servidor: acima disso o `PATCH` recusa. */
export const MAX_QUESTION_OPTIONS = 20

export type InputValidation = 'text' | 'email' | 'cpf' | 'number' | 'date'

/** Nome que o usuário dá ao bloco. Só organização — o cliente nunca vê. */
export type NodeName = string

/** Onde o bloco fica no canvas. Ausente = layout calculado. */
export type NodePosition = { x: number; y: number }

/** De que lado cada saída sai, por id de porta. Ausente = pela direita. */
export type PortSides = Record<string, 'right' | 'bottom'>

export type QuestionOption = {
  label: string
  value: string
  /**
   * Outras respostas que levam a esta opção ("ajuda" para "Suporte").
   *
   * O rótulo é o que o cliente lê na mensagem, então não serve para ensinar o bot: mudar
   * "Suporte" para "Suporte/ajuda" mudaria o texto exibido. Ver `matchOption` na API.
   */
  aliases?: string[]
  next: NodeId
}

export type VarOperator = 'eq' | 'neq' | 'contains' | 'empty' | 'notEmpty'

export type VarTest = {
  var: string
  op: VarOperator
  value?: string
}

/** Num só lugar: com tabelas separadas, o cartão e o painel diriam coisas diferentes. */
export const VAR_OPERATOR_LABEL: Record<VarOperator, string> = {
  notEmpty: 'tem',
  empty: 'vazia',
  eq: '=',
  neq: '≠',
  contains: 'contém',
}

/** Ordem em que o editor oferece os operadores. */
export const VAR_OPERATORS: VarOperator[] = [
  'notEmpty',
  'empty',
  'eq',
  'neq',
  'contains',
]

/** Condição em uma linha. Antes o cartão contava os ramos sem dizer o que testam. */
export function describeVarTest(test: VarTest): string {
  const nome = test.var.trim() || 'variável'
  const operador = VAR_OPERATOR_LABEL[test.op]

  if (test.op === 'empty' || test.op === 'notEmpty') {
    return `${nome} ${operador}`
  }

  return `${nome} ${operador} ${test.value?.trim() || '?'}`
}

export type HandoffTarget =
  | { type: 'queue' }
  | { type: 'user'; bitrixUserId: string }
  | { type: 'line'; lineId: string }

export type HandoffTargetType = HandoffTarget['type']

/** Rótulos do seletor de entrega, na ordem em que o painel os oferece. */
export const HANDOFF_TARGET_LABEL: Record<HandoffTargetType, string> = {
  queue: 'Fila do canal aberto',
  user: 'Atendente específico',
  line: 'Outro canal aberto',
}

export const HANDOFF_TARGET_TYPES: HandoffTargetType[] = [
  'queue',
  'user',
  'line',
]

export type MessageNode = {
  id: NodeId
  kind: 'message'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  next: NodeId
}

export type QuestionNode = {
  id: NodeId
  kind: 'question'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  options: QuestionOption[]
  saveAs?: string
  retryText?: string
  maxAttempts: number
  onExhausted: NodeId
}

export type InputNode = {
  id: NodeId
  kind: 'input'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text: string
  saveAs: string
  validate: InputValidation
  retryText?: string
  maxAttempts: number
  onExhausted: NodeId
  next: NodeId
}

export type ConditionNode = {
  id: NodeId
  kind: 'condition'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  branches: Array<{ when: VarTest; next: NodeId }>
  otherwise: NodeId
}

export type HandoffNode = {
  id: NodeId
  kind: 'handoff'
  position?: NodePosition
  portSides?: PortSides
  name?: NodeName
  text?: string
  target: HandoffTarget
}

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

export type FlowNodeKind = FlowNode['kind']

export type FlowSettings = {
  escapeKeywords: string[]
  /** Para quem a conversa vai quando a palavra aparece. `null` desliga a saída. */
  escapeTarget: HandoffTarget | null
  /** Última fala antes de transferir. Ausente = transferência calada. */
  escapeText?: string
}

export type BotFlowGraph = {
  entryNodeId: NodeId
  nodes: FlowNode[]
  settings: FlowSettings
}

export type BotFlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type BotFlow = {
  id: string
  appId: string
  name: string
  status: BotFlowStatus
  version: number
  graph: BotFlowGraph
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type BotFlowSummary = Omit<BotFlow, 'graph'> & { nodeCount: number }

export type FlowIssueCode =
  | 'malformed'
  | 'duplicate-node-id'
  | 'entry-not-found'
  | 'target-not-found'
  | 'unreachable-node'
  | 'loop-without-wait'
  | 'no-terminal-reachable'
  | 'escape-target-incomplete'
  | 'duplicate-option-value'
  | 'self-target'
  | 'handoff-target-incomplete'
  | 'condition-var-invalid'
  | 'node-text-missing'

export type FlowIssue = {
  code: FlowIssueCode
  nodeId?: NodeId
  detail?: string
}

export type BotFlowBinding = {
  id: string
  appId: string
  flowId: string
  flowName: string
  flowStatus: BotFlowStatus
  lineId: string
  priority: number
  active: boolean
  condition: unknown | null
  createdAt: string
  updatedAt: string
}

export type BotEffect =
  | { kind: 'say'; text: string }
  | { kind: 'handoff'; target: HandoffTarget }
  | { kind: 'finish' }
  | { kind: 'abort'; reason: 'loop' | 'unknown-node' }

export type SimulationState = {
  currentNodeId: NodeId
  vars: Record<string, string>
  attempts: number
}

/** Rótulos por tipo de nó, compartilhados entre o `select` e o card. */
export const NODE_KIND_LABEL: Record<FlowNodeKind, string> = {
  message: 'Mensagem',
  question: 'Pergunta',
  input: 'Captura',
  condition: 'Condição',
  handoff: 'Atendente',
  finish: 'Encerrar',
}

export const NODE_KIND_ORDER: FlowNodeKind[] = [
  'message',
  'question',
  'input',
  'condition',
  'handoff',
  'finish',
]

/** Separa o que o bot fala do que acontece com o atendimento. */
export const NODE_KIND_GROUPS: Array<{
  titulo: string
  kinds: FlowNodeKind[]
}> = [
  { titulo: 'Conversa', kinds: ['message', 'question', 'input'] },
  { titulo: 'Ações do chat', kinds: ['condition', 'handoff', 'finish'] },
]

/** Uma linha de ajuda por tipo: o rótulo sozinho não diz o que o bloco faz. */
export const NODE_KIND_HINT: Record<FlowNodeKind, string> = {
  message: 'Fala e segue adiante',
  question: 'Oferece opções e espera a escolha',
  input: 'Pergunta e guarda a resposta',
  condition: 'Desvia conforme o que foi respondido',
  handoff: 'Entrega a conversa para um atendente',
  finish: 'Encerra o atendimento',
}

/** Saídas de um nó, na ordem em que o editor as mostra. */
export function nodeOutgoing(node: FlowNode): NodeId[] {
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

/**
 * Remove um passo e religa quem apontava para ele, herdando o destino do removido.
 * Sem isso cada referência órfã viraria `target-not-found` na publicação.
 */
export function removeNode(graph: BotFlowGraph, nodeId: NodeId): BotFlowGraph {
  const removido = graph.nodes.find(node => node.id === nodeId)
  if (!removido) return graph

  const restantes = graph.nodes.filter(node => node.id !== nodeId)
  if (restantes.length === 0) return graph

  /** Primeira saída do removido; se era terminal, o que sobrou no topo da lista. */
  const substituto =
    nodeOutgoing(removido).find(
      target => target !== nodeId && restantes.some(n => n.id === target),
    ) ?? restantes[0].id

  const redirect = (target: NodeId): NodeId =>
    target === nodeId ? substituto : target

  const nodes = restantes.map((node): FlowNode => {
    switch (node.kind) {
      case 'message':
        return { ...node, next: redirect(node.next) }
      case 'question':
        return {
          ...node,
          options: node.options.map(option => ({
            ...option,
            next: redirect(option.next),
          })),
          onExhausted: redirect(node.onExhausted),
        }
      case 'input':
        return {
          ...node,
          next: redirect(node.next),
          onExhausted: redirect(node.onExhausted),
        }
      case 'condition':
        return {
          ...node,
          branches: node.branches.map(branch => ({
            ...branch,
            next: redirect(branch.next),
          })),
          otherwise: redirect(node.otherwise),
        }
      case 'handoff':
      case 'finish':
        return node
    }
  })

  // `settings` passa intacto: a saída de emergência guarda alvo de entrega, não id de bloco.
  return {
    entryNodeId: redirect(graph.entryNodeId),
    nodes,
    settings: graph.settings,
  }
}

/** Maior sufixo em uso + 1: pelo tamanho da lista reusaria valor já existente. */
export function nextOptionValue(options: QuestionOption[]): string {
  const maior = options.reduce((max, option) => {
    const match = /^opcao-(\d+)$/.exec(option.value)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `opcao-${maior + 1}`
}

/** Próximo id livre no formato `nN`, para não colidir com nó existente. */
export function nextNodeId(graph: BotFlowGraph): NodeId {
  const used = new Set(graph.nodes.map(node => node.id))
  for (let index = 1; index <= used.size + 1; index += 1) {
    const candidate = `n${index}`
    if (!used.has(candidate)) return candidate
  }
  return `n${used.size + 1}`
}

/**
 * Bloco novo com as saídas pendentes: toda saída aponta para o próprio bloco, que é como
 * o grafo representa "sem destino" — o schema exige um id em todo destino. O editor lê
 * isso como pendência e deixa a saída livre para arrastar.
 */
export function makeNode(kind: FlowNodeKind, id: NodeId): FlowNode {
  switch (kind) {
    case 'message':
      return { id, kind, text: '', next: id }
    case 'question':
      return {
        id,
        kind,
        text: '',
        options: [{ label: '', value: 'opcao-1', next: id }],
        maxAttempts: 3,
        onExhausted: id,
      }
    case 'input':
      return {
        id,
        kind,
        text: '',
        saveAs: 'resposta',
        validate: 'text',
        maxAttempts: 3,
        onExhausted: id,
        next: id,
      }
    case 'condition':
      return {
        id,
        kind,
        branches: [{ when: { var: 'resposta', op: 'notEmpty' }, next: id }],
        otherwise: id,
      }
    case 'handoff':
      return { id, kind, text: '', target: { type: 'queue' } }
    case 'finish':
      return { id, kind, text: '' }
  }
}

/**
 * Variáveis que o worker semeia antes do primeiro passo, dos vínculos de CRM do chat.
 *
 * Contrato com a API (`crmVars` em `crm-entities.ts`): renomear aqui quebra todo fluxo
 * publicado que as use.
 */
export const CRM_VAR_LABEL: Record<string, string> = {
  contatoId: 'Contato do CRM',
  leadId: 'Lead do CRM',
  empresaId: 'Empresa do CRM',
  negocioId: 'Negócio do CRM',
}

/**
 * Blocos com o conteúdo já preenchido, oferecidos ao lado dos tipos crus.
 *
 * Não são um `kind` novo — produzem um nó comum, editável como qualquer outro. O que
 * entregam é o preenchimento: quem monta o fluxo não precisa saber que existe uma
 * variável chamada `contatoId` nem qual operador usar.
 */
export type NodeRecipe = {
  id: string
  label: string
  hint: string
  kind: FlowNodeKind
  make: (id: NodeId) => FlowNode
}

export const NODE_RECIPES: NodeRecipe[] = [
  {
    id: 'ja-e-cliente',
    label: 'Já é cliente?',
    hint: 'Desvia se o contato já existe no CRM',
    kind: 'condition',
    make: id => ({
      id,
      kind: 'condition',
      name: 'Já é cliente?',
      // `contatoId` e não `leadId`: o Bitrix abre um lead sozinho no primeiro contato,
      // então lead preenchido não distingue cliente de desconhecido.
      branches: [{ when: { var: 'contatoId', op: 'notEmpty' }, next: id }],
      otherwise: id,
    }),
  },
  {
    id: 'tem-negocio',
    label: 'Tem negócio aberto?',
    hint: 'Desvia se o chat está ligado a um negócio',
    kind: 'condition',
    make: id => ({
      id,
      kind: 'condition',
      name: 'Tem negócio aberto?',
      branches: [{ when: { var: 'negocioId', op: 'notEmpty' }, next: id }],
      otherwise: id,
    }),
  },
]
