import {
  type BotFlowGraph,
  type FlowNode,
  type HandoffTarget,
  type NodeId,
  type VarTest,
  type WaitingNode,
  findNode,
  isWaiting,
  shouldWhisperSummary,
} from './flow'
import { handoffSummary } from './handoff-summary'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '../notices/notice-locale'
import { matchOption, matchesEscape, normalizeAnswer } from './match-answer'
import { WORKING_HOURS_VAR, captureVar, choiceVar, renderVars } from './vars'

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
  /** Vai ao chat sem chegar ao cliente: contexto para quem assume o atendimento. */
  | { kind: 'whisper'; text: string }
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

/**
 * Rega as variáveis do portal sobre as da sessão a cada turno: o `JOINCHAT` não traz o
 * usuário, então a sessão nasce com `bitrix.name` vazio e só o `MESSAGEADD` seguinte sabe
 * o nome. Vazio não sobrescreve — um turno sem o dado não apaga o que outro descobriu.
 */
function seedPortalVars(
  vars: Record<string, string>,
  initialVars: Record<string, string>,
): Record<string, string> {
  const merged = { ...vars }

  for (const [nome, valor] of Object.entries(initialVars)) {
    if (valor.trim()) merged[nome] = valor
  }

  return merged
}

export function advance(
  graph: BotFlowGraph,
  state: BotSessionState | null,
  input: BotInput,
  // Vínculos de CRM do chat e nome do contato. Valem em todo turno — ver `seedPortalVars`.
  initialVars: Record<string, string> = {},
  // Idioma da instalação: só o texto fixo do resumo na transferência depende dele.
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): AdvanceResult {
  const effects: BotEffect[] = []

  if (input.kind === 'start') {
    return walk(graph, graph.entryNodeId, { ...initialVars }, effects, locale)
  }

  /** Sem estado: mensagem de sessão que já terminou ou expirou — recomeça. */
  if (!state) {
    return walk(graph, graph.entryNodeId, { ...initialVars }, effects, locale)
  }

  const current = findNode(graph, state.currentNodeId)
  if (!current) {
    effects.push({ kind: 'abort', reason: 'unknown-node' })
    return { effects, state: null, awaiting: null }
  }

  const vars = seedPortalVars(state.vars, initialVars)

  // Resposta para nó que não perguntou nada: retoma em vez de descartar.
  if (!isWaiting(current)) {
    return walk(graph, current.id, vars, effects, locale)
  }

  // Transfere na hora, sem passar por bloco: a saída de emergência é um handoff avulso.
  const escapeTarget = graph.settings.escapeTarget
  if (
    escapeTarget &&
    matchesEscape(input.text, graph.settings.escapeKeywords)
  ) {
    const despedida = graph.settings.escapeText?.trim()
    if (despedida) {
      effects.push({ kind: 'say', text: renderVars(despedida, vars) })
    }
    pushSummary(graph, vars, effects, locale)
    effects.push({ kind: 'handoff', target: escapeTarget })
    return { effects, state: null, awaiting: null }
  }

  return answerWaiting(
    graph,
    current,
    { ...state, vars },
    input.text,
    effects,
    locale,
  )
}

/** Vale para os dois caminhos de handoff: bloco terminal e saída de emergência. */
function pushSummary(
  graph: BotFlowGraph,
  vars: Record<string, string>,
  effects: BotEffect[],
  locale: NoticeLocale,
): void {
  if (!shouldWhisperSummary(graph.settings)) return
  effects.push({ kind: 'whisper', text: handoffSummary(graph, vars, locale) })
}

function answerWaiting(
  graph: BotFlowGraph,
  node: WaitingNode,
  state: BotSessionState,
  text: string,
  effects: BotEffect[],
  locale: NoticeLocale,
): AdvanceResult {
  const vars = { ...state.vars }

  // Sem opção para casar, não há o que reperguntar: toda resposta serve.
  if (node.kind === 'message') {
    vars[captureVar(node.capture)] = text.trim()
    return walk(graph, node.next, vars, effects, locale)
  }

  const match = matchOption(node, text)
  if (match.matched) {
    if (node.capture) {
      vars[captureVar(node.capture)] = match.option.value
    } else {
      // Sem captura a escolha não deixava rastro, e o resumo do handoff chegava ao
      // operador sem os menus que o cliente percorreu. Guarda o rótulo, que é o que ele leu.
      vars[choiceVar(node.id)] = match.option.label
    }
    return walk(graph, match.option.next, vars, effects, locale)
  }

  // `maxAttempts` conta falhas toleradas, incluindo esta: com 2, o cliente é perguntado de
  // novo uma vez e a segunda falha desvia.
  const attempts = state.attempts + 1
  if (attempts >= node.maxAttempts) {
    return walk(graph, node.onExhausted, vars, effects, locale)
  }

  effects.push({ kind: 'say', text: askText(node, vars, node.retryText) })
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
  locale: NoticeLocale,
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
        effects.push({ kind: 'say', text: renderVars(node.text, vars) })
        if (!isWaiting(node)) {
          cursor = node.next
          continue
        }
        return {
          effects,
          state: { currentNodeId: node.id, vars, attempts: 0 },
          awaiting: node,
        }

      case 'condition':
        cursor = resolveCondition(node.branches, node.otherwise, vars)
        continue

      case 'schedule':
        // Var ausente = dentro do horário.
        cursor =
          vars[WORKING_HOURS_VAR] === 'N' ? node.whenClosed : node.whenOpen
        continue

      case 'question':
        effects.push({ kind: 'say', text: askText(node, vars) })
        return {
          effects,
          state: { currentNodeId: node.id, vars, attempts: 0 },
          awaiting: node,
        }

      case 'handoff':
        if (node.text) {
          effects.push({ kind: 'say', text: renderVars(node.text, vars) })
        }
        pushSummary(graph, vars, effects, locale)
        effects.push({ kind: 'handoff', target: node.target })
        return { effects, state: null, awaiting: null }

      case 'finish':
        if (node.text) {
          effects.push({ kind: 'say', text: renderVars(node.text, vars) })
        }
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
export function askText(
  node: WaitingNode,
  vars: Record<string, string> = {},
  override?: string,
): string {
  const base = renderVars(override ?? node.text, vars)
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
