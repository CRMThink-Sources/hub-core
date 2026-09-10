import {
  type BotFlowGraph,
  type FlowNode,
  type HandoffTarget,
  type NodeId,
  type VarTest,
  type WaitingNode,
  findNode,
  isWaiting,
} from './flow'
import {
  matchOption,
  matchesEscape,
  normalizeAnswer,
  validateInput,
} from './match-answer'

// O motor do fluxo: `(fluxo, estado, entrada) → (falas, próximo estado)`. Worker, simulador
// do editor e teste consomem o mesmo contrato.

export type BotSessionState = {
  currentNodeId: NodeId
  vars: Record<string, string>
  /** Tentativas gastas no nó atual. Zera ao sair dele. */
  attempts: number
}

export type BotEffect =
  | { kind: 'say'; text: string }
  | { kind: 'handoff'; target: HandoffTarget }
  | { kind: 'finish' }
  /** Fluxo quebrado em runtime. O chamador entrega para humano e loga. */
  | { kind: 'abort'; reason: 'loop' | 'unknown-node' }

/** `start` é sessão nova (`ONIMBOTV2JOINCHAT`) e ignora estado anterior. */
export type BotInput = { kind: 'start' } | { kind: 'text'; text: string }

export type AdvanceResult = {
  /** Em ordem. Falas consecutivas saem numa mensagem só — ver `collapseSays`. */
  effects: BotEffect[]
  /** `null` = sessão terminou (handoff, finish ou abort). */
  state: BotSessionState | null
  /** Nó esperando resposta, quando a sessão continua. */
  awaiting: WaitingNode | null
}

/** Teto de nós por chamada: fluxo gravado antes da validação viraria laço infinito. */
const MAX_STEPS = 50

export function advance(
  graph: BotFlowGraph,
  state: BotSessionState | null,
  input: BotInput,
  // Variáveis já conhecidas quando a conversa começa (vínculos de CRM do chat). Entram
  // aqui e não no `walk` porque só valem para sessão nova: a sessão viva carrega as suas.
  initialVars: Record<string, string> = {},
): AdvanceResult {
  const effects: BotEffect[] = []

  if (input.kind === 'start') {
    return walk(graph, graph.entryNodeId, { ...initialVars }, effects)
  }

  /** Sem estado: mensagem de sessão que já terminou ou expirou — recomeça. */
  if (!state) {
    return walk(graph, graph.entryNodeId, { ...initialVars }, effects)
  }

  const current = findNode(graph, state.currentNodeId)
  if (!current) {
    effects.push({ kind: 'abort', reason: 'unknown-node' })
    return { effects, state: null, awaiting: null }
  }

  // Resposta para nó que não perguntou nada: retoma em vez de descartar.
  if (!isWaiting(current)) {
    return walk(graph, current.id, state.vars, effects)
  }

  const escapeTarget = graph.settings.escapeNext
  if (
    escapeTarget &&
    matchesEscape(input.text, graph.settings.escapeKeywords)
  ) {
    return walk(graph, escapeTarget, state.vars, effects)
  }

  return answerWaiting(graph, current, state, input.text, effects)
}

function answerWaiting(
  graph: BotFlowGraph,
  node: WaitingNode,
  state: BotSessionState,
  text: string,
  effects: BotEffect[],
): AdvanceResult {
  const vars = { ...state.vars }

  if (node.kind === 'question') {
    const match = matchOption(node, text)
    if (match.matched) {
      if (node.saveAs) vars[node.saveAs] = match.option.value
      return walk(graph, match.option.next, vars, effects)
    }
  } else {
    const validated = validateInput(text, node.validate)
    if (validated.valid) {
      vars[node.saveAs] = validated.value
      return walk(graph, node.next, vars, effects)
    }
  }

  // `maxAttempts` conta falhas toleradas, incluindo esta: com 2, o cliente é perguntado de
  // novo uma vez e a segunda falha desvia.
  const attempts = state.attempts + 1
  if (attempts >= node.maxAttempts) {
    return walk(graph, node.onExhausted, vars, effects)
  }

  effects.push({ kind: 'say', text: askText(node, node.retryText) })
  return {
    effects,
    state: { currentNodeId: node.id, vars, attempts },
    awaiting: node,
  }
}

// Anda até parar em nó de espera ou terminal. `message` e `condition` não param, e é isso
// que resolve "boas-vindas + pergunta" numa chamada em vez de uma ida ao Bitrix por nó.
function walk(
  graph: BotFlowGraph,
  from: NodeId,
  vars: Record<string, string>,
  effects: BotEffect[],
): AdvanceResult {
  let cursor: NodeId = from

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const node: FlowNode | undefined = findNode(graph, cursor)
    if (!node) {
      effects.push({ kind: 'abort', reason: 'unknown-node' })
      return { effects, state: null, awaiting: null }
    }

    switch (node.kind) {
      case 'message':
        effects.push({ kind: 'say', text: node.text })
        cursor = node.next
        continue

      case 'condition':
        cursor = resolveCondition(node.branches, node.otherwise, vars)
        continue

      case 'question':
      case 'input':
        effects.push({ kind: 'say', text: askText(node) })
        return {
          effects,
          state: { currentNodeId: node.id, vars, attempts: 0 },
          awaiting: node,
        }

      case 'handoff':
        if (node.text) effects.push({ kind: 'say', text: node.text })
        effects.push({ kind: 'handoff', target: node.target })
        return { effects, state: null, awaiting: null }

      case 'finish':
        if (node.text) effects.push({ kind: 'say', text: node.text })
        effects.push({ kind: 'finish' })
        return { effects, state: null, awaiting: null }
    }
  }

  effects.push({ kind: 'abort', reason: 'loop' })
  return { effects, state: null, awaiting: null }
}

function resolveCondition(
  branches: Array<{ when: VarTest; next: NodeId }>,
  otherwise: NodeId,
  vars: Record<string, string>,
): NodeId {
  const hit = branches.find(branch => testVar(branch.when, vars))
  return hit ? hit.next : otherwise
}

export function testVar(test: VarTest, vars: Record<string, string>): boolean {
  const actual = vars[test.var]

  switch (test.op) {
    case 'empty':
      return actual === undefined || actual.trim() === ''
    case 'notEmpty':
      return actual !== undefined && actual.trim() !== ''
    case 'eq':
      return normalizeAnswer(actual ?? '') === normalizeAnswer(test.value ?? '')
    case 'neq':
      return normalizeAnswer(actual ?? '') !== normalizeAnswer(test.value ?? '')
    case 'contains':
      return normalizeAnswer(actual ?? '').includes(
        normalizeAnswer(test.value ?? ''),
      )
  }
}

// As opções vão dentro do texto porque o conector entrega texto puro, sem botão.
export function askText(node: WaitingNode, override?: string): string {
  const base = override ?? node.text
  const options = renderOptions(node)

  return options ? `${base}\n\n${options}` : base
}

// Cada fala consome uma request do orçamento do portal.
export function collapseSays(
  effects: BotEffect[],
  separator = '\n\n',
): BotEffect[] {
  const collapsed: BotEffect[] = []

  for (const effect of effects) {
    const previous = collapsed[collapsed.length - 1]
    if (effect.kind === 'say' && previous?.kind === 'say') {
      collapsed[collapsed.length - 1] = {
        kind: 'say',
        text: `${previous.text}${separator}${effect.text}`,
      }
      continue
    }
    collapsed.push(effect)
  }

  return collapsed
}

export function renderOptions(node: WaitingNode): string | null {
  if (node.kind !== 'question') return null

  return node.options
    .map((option, index) => `${index + 1} · ${option.label}`)
    .join('\n')
}
