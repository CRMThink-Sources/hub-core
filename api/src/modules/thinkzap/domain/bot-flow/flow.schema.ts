import z from 'zod'
import {
  type BotFlowGraph,
  DEFAULT_FLOW_SETTINGS,
  type HandoffTarget,
  type NodeId,
  isTerminal,
  isWaiting,
  outgoing,
} from './flow'
import {
  CAPTURE_NAMESPACE,
  SYSTEM_VARS,
  VAR_NAME_PATTERN,
  captureVar,
  varsUsedIn,
} from './vars'

// Duas camadas: o zod diz se o JSON é um fluxo; `validateFlowGraph` diz se ele funciona.

/** Teto de opções por pergunta. O editor lê a mesma constante. */
export const MAX_QUESTION_OPTIONS = 20

const nodeIdSchema = z.string().min(1).max(64)

// Aceita vazio na forma e cobra em `validateFlowGraph` (`node-text-missing`): `makeNode`
// cria o bloco com `text: ''`, e recusar aqui reprovaria o grafo inteiro sem dizer o campo.
const requiredTextSchema = z.string().max(4096)

/** Fala opcional de `handoff` / `finish`: entrega e encerramento calados são válidos. */
const optionalTextSchema = z
  .string()
  .max(4096)
  .optional()
  .transform(value => {
    const texto = value?.trim()
    return texto ? texto : undefined
  })

const nodeNameSchema = z.string().trim().max(60).optional()

// Opcional: fluxo anterior ao canvas segue válido.
const positionSchema = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .optional()
const portSidesSchema = z
  .record(z.string().max(32), z.enum(['right', 'bottom']))
  .optional()

const varNameSchema = z
  .string()
  .min(1)
  .max(64)
  // Identificador simples: variável é interpolada em texto e comparada em condição.
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'nome de variável inválido')

// `var` não usa `varNameSchema` de propósito: ramo recém-criado nasce com `var: ''`, e
// recusar aqui marcaria o grafo inteiro como `malformed`. Cobrado em `validateFlowGraph`
// como `condition-var-invalid`, que aponta o bloco.
const varTestSchema = z.object({
  var: z.string().max(64),
  op: z.enum(['eq', 'neq', 'contains', 'empty', 'notEmpty']),
  value: z.string().optional(),
})

const messageNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('message'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: requiredTextSchema,
  // Presente = o bloco espera a resposta e a guarda em `capture.<nome>`.
  capture: varNameSchema.optional(),
  next: nodeIdSchema,
})

const questionNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('question'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: requiredTextSchema,
  options: z
    .array(
      z.object({
        // Sem `min(1)`, como `varTestSchema.var` e pelo mesmo motivo: opção recém-criada
        // nasce vazia, e o rascunho salva a cada tecla. Recusar aqui derrubava o
        // autosave inteiro enquanto o autor trocava o rótulo. Cobrado em
        // `validateFlowGraph` como `option-label-missing`, que aponta o bloco.
        value: z.string().max(120),
        label: z.string().max(120),
        /**
         * Outras respostas que levam a esta opção ("ajuda" para "Suporte").
         *
         * Teto de 20 e 40 caracteres por item: a lista é casada por igualdade a cada
         * resposta, e sem limite um fluxo salvo com centenas de entradas viraria custo
         * por mensagem. `optional` porque todo fluxo publicado antes disto não tem o
         * campo.
         */
        aliases: z.array(z.string().min(1).max(40)).max(20).optional(),
        next: nodeIdSchema,
      }),
    )
    .min(1)
    // As opções saem numeradas em texto puro no WhatsApp, sem botão: o teto evita a
    // mensagem-parede.
    .max(MAX_QUESTION_OPTIONS),
  capture: varNameSchema.optional(),
  retryText: z.string().min(1).optional(),
  maxAttempts: z.number().int().min(1).max(10),
  onExhausted: nodeIdSchema,
})

const conditionNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('condition'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  branches: z
    .array(z.object({ when: varTestSchema, next: nodeIdSchema }))
    .min(1),
  otherwise: nodeIdSchema,
  // Rótulo de origem, só para o editor. `optional` porque todo fluxo salvo antes disto
  // não tem o campo.
  recipeId: z.string().max(40).optional(),
})

// Sem `min(1)` nos ids nem na lista: o editor grava o alvo antes de escolher o atendente.
// Alvo vazio é `handoff-target-incomplete` em `validateFlowGraph`, que aponta o nó.
//
// O teto de 50 atendentes existe porque a lista é percorrida a cada entrega e nada no
// editor impede colar um portal inteiro.
const handoffTargetSchema = z.preprocess(
  migrateUserTarget,
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('queue') }),
    z.object({ type: z.literal('line'), lineId: z.string() }),
    z.object({
      type: z.literal('evenly'),
      bitrixUserIds: z.array(z.string()).max(50),
    }),
    z.object({
      type: z.literal('all'),
      bitrixUserIds: z.array(z.string()).max(50),
    }),
  ]),
)

/**
 * Alvo salvo antes da distribuição guarda `{ type: 'user', bitrixUserId }` — um atendente
 * só. Vira `evenly` com um item: o rodízio de um nome é o próprio nome, então o fluxo
 * publicado continua entregando para quem já entregava.
 */
function migrateUserTarget(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw

  const target = raw as { type?: unknown; bitrixUserId?: unknown }
  if (target.type !== 'user') return raw

  const id = typeof target.bitrixUserId === 'string' ? target.bitrixUserId : ''
  return { type: 'evenly', bitrixUserIds: id.trim() ? [id] : [] }
}

const scheduleNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('schedule'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  whenOpen: nodeIdSchema,
  whenClosed: nodeIdSchema,
})

const handoffNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('handoff'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: optionalTextSchema,
  target: handoffTargetSchema,
})

const finishNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('finish'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: optionalTextSchema,
})

const flowNodeSchema = z.discriminatedUnion('kind', [
  messageNodeSchema,
  questionNodeSchema,
  conditionNodeSchema,
  scheduleNodeSchema,
  handoffNodeSchema,
  finishNodeSchema,
])

const flowSettingsSchema = z.object({
  escapeKeywords: z.array(z.string().min(1)).max(20),
  escapeTarget: handoffTargetSchema.nullable(),
  escapeText: optionalTextSchema,
  // `default(true)`: fluxo gravado antes do ajuste sussurrava o resumo, e parsear não
  // pode desligar em silêncio um bot que já está no ar.
  whisperSummary: z.boolean().default(true),
})

const rawGraphSchema = z.object({
  entryNodeId: nodeIdSchema,
  // Sem teto de blocos: quem protege o worker é `MAX_STEPS` em `advance`, que limita
  // passos por mensagem e não tamanho do fluxo.
  nodes: z.array(flowNodeSchema).min(1),
  // Fábrica, não o objeto: referência compartilhada faria todos os fluxos parseados
  // apontarem para o mesmo `escapeKeywords`.
  settings: flowSettingsSchema.default(() => ({
    ...DEFAULT_FLOW_SETTINGS,
    escapeKeywords: [...DEFAULT_FLOW_SETTINGS.escapeKeywords],
    escapeText: DEFAULT_FLOW_SETTINGS.escapeText,
    whisperSummary: DEFAULT_FLOW_SETTINGS.whisperSummary ?? true,
  })),
})

export const botFlowGraphSchema = z.preprocess(
  raw => migrateCapture(migrateEscapeNext(raw)),
  rawGraphSchema,
)

/**
 * Fluxo salvo quando a captura era um bloco: `input` vira mensagem que captura, `saveAs`
 * vira `capture` e a condição passa a testar o nome com namespace.
 */
function migrateCapture(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw

  const graph = raw as { nodes?: unknown }
  if (!Array.isArray(graph.nodes)) return raw

  const capturados = new Set<string>()

  const nodes = (graph.nodes as unknown[]).map((node): unknown => {
    if (!node || typeof node !== 'object') return node

    const { kind, saveAs, capture, ...resto } = node as Record<string, unknown>
    const nome = typeof capture === 'string' ? capture : saveAs

    if (kind !== 'input' && kind !== 'question') return node
    if (typeof nome !== 'string' || !nome.trim()) {
      return kind === 'input' ? { ...resto, kind: 'message' } : node
    }

    capturados.add(nome)
    return kind === 'input'
      ? { ...resto, kind: 'message', capture: nome }
      : { ...resto, kind, capture: nome }
  })

  return {
    ...graph,
    nodes: nodes.map(node => migrateVarTests(node, capturados)),
  }
}

const LEGACY_SYSTEM_VARS: Record<string, string> = {
  contatoId: 'bitrix.contactId',
  leadId: 'bitrix.leadId',
  empresaId: 'bitrix.companyId',
  negocioId: 'bitrix.dealId',
}

function migrateVarTests(node: unknown, capturados: Set<string>): unknown {
  if (!node || typeof node !== 'object') return node

  const condition = node as { kind?: unknown; branches?: unknown }
  if (condition.kind !== 'condition' || !Array.isArray(condition.branches)) {
    return node
  }

  const branches = (condition.branches as unknown[]).map((branch): unknown => {
    if (!branch || typeof branch !== 'object') return branch

    const { when, ...resto } = branch as { when?: unknown }
    if (!when || typeof when !== 'object') return branch

    const test = when as { var?: unknown }
    const nome = typeof test.var === 'string' ? test.var : ''
    // Já migrado: só nome cru é reescrito, senão `capture.x` viraria `capture.capture.x`.
    if (!nome || nome.includes('.')) return branch

    const novo = capturados.has(nome)
      ? `${CAPTURE_NAMESPACE}.${nome}`
      : LEGACY_SYSTEM_VARS[nome]

    return novo ? { ...resto, when: { ...test, var: novo } } : branch
  })

  return { ...condition, branches }
}

/**
 * Fluxo salvo antes da mudança guarda `escapeNext`, um id de bloco. A saída de emergência
 * agora transfere direto, então o id só sobrevive quando apontava para um `handoff`: aí o
 * alvo daquele bloco vira o alvo do escape. Apontando para qualquer outro bloco, a saída é
 * desligada — pular para o meio do fluxo deixou de existir.
 */
function migrateEscapeNext(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw

  const graph = raw as {
    nodes?: unknown
    settings?: Record<string, unknown> | null
  }
  const settings = graph.settings
  if (!settings || typeof settings !== 'object') return raw
  if (!('escapeNext' in settings) || 'escapeTarget' in settings) return raw

  const { escapeNext, ...resto } = settings
  const alvo = Array.isArray(graph.nodes)
    ? graph.nodes.find(
        (node): node is { kind: 'handoff'; target: unknown } =>
          !!node &&
          typeof node === 'object' &&
          (node as { id?: unknown }).id === escapeNext &&
          (node as { kind?: unknown }).kind === 'handoff',
      )?.target
    : undefined

  return { ...graph, settings: { ...resto, escapeTarget: alvo ?? null } }
}

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
  | 'option-label-missing'
  | 'self-target'
  | 'handoff-target-incomplete'
  | 'condition-var-invalid'
  | 'node-text-missing'
  | 'unknown-var'
  | 'schedule-path-missing'

export type FlowIssue = {
  code: FlowIssueCode
  detail: string
  nodeId?: NodeId
}

/** `null` = JSON não é um fluxo. Erro de forma, não de conteúdo. */
export function parseBotFlowGraph(raw: unknown): BotFlowGraph | null {
  const parsed = botFlowGraphSchema.safeParse(raw)
  return parsed.success ? (parsed.data as BotFlowGraph) : null
}

// Lista vazia = fluxo publicável. Devolve tudo de uma vez, não o primeiro erro.
export function validateFlowGraph(raw: unknown): FlowIssue[] {
  const graph = parseBotFlowGraph(raw)
  if (!graph) {
    return [{ code: 'malformed', detail: 'JSON não corresponde a um fluxo' }]
  }

  const issues: FlowIssue[] = []

  // Sem olhar posição no grafo: a captura pode estar num ramo que nem sempre roda.
  const conhecidas = new Set<string>([
    ...SYSTEM_VARS,
    ...graph.nodes.flatMap(node =>
      (node.kind === 'message' || node.kind === 'question') && node.capture
        ? [captureVar(node.capture)]
        : [],
    ),
  ])

  // Também serve de índice de existência: `findNode` varreria a lista por destino.
  const seen = new Set<NodeId>()
  for (const node of graph.nodes) {
    if (seen.has(node.id)) {
      issues.push({
        code: 'duplicate-node-id',
        nodeId: node.id,
        detail: `id "${node.id}" aparece mais de uma vez`,
      })
    }
    seen.add(node.id)
  }

  if (!seen.has(graph.entryNodeId)) {
    issues.push({
      code: 'entry-not-found',
      nodeId: graph.entryNodeId,
      detail: `nó de entrada "${graph.entryNodeId}" não existe`,
    })
  }

  for (const node of graph.nodes) {
    for (const target of outgoing(node)) {
      if (!seen.has(target)) {
        issues.push({
          code: 'target-not-found',
          nodeId: node.id,
          detail: `destino "${target}" não existe`,
        })
      }
    }

    if (
      (node.kind === 'message' || node.kind === 'question') &&
      !node.text.trim()
    ) {
      issues.push({
        code: 'node-text-missing',
        nodeId: node.id,
        detail:
          node.kind === 'message'
            ? 'escreva o que o bot diz neste bloco'
            : 'escreva o que o bot pergunta neste bloco',
      })
    }

    if (node.kind === 'condition') {
      node.branches.forEach((branch, index) => {
        const nome = branch.when.var.trim()

        if (!VAR_NAME_PATTERN.test(nome)) {
          issues.push({
            code: 'condition-var-invalid',
            nodeId: node.id,
            detail: nome
              ? `condição ${index + 1}: "${nome}" não é um nome de variável válido`
              : `condição ${index + 1}: escolha a variável a testar`,
          })
          return
        }

        // Comparar nome que ninguém preenche não quebra nada, e é pior: a condição
        // desvia sempre pelo mesmo lado sem dizer por quê.
        if (!conhecidas.has(nome)) {
          issues.push({
            code: 'unknown-var',
            nodeId: node.id,
            detail: `condição ${index + 1}: "${nome}" não é uma variável deste fluxo`,
          })
        }
      })
    }

    if (node.kind === 'handoff') {
      const alvo = node.target

      if (!isTargetComplete(alvo)) {
        issues.push({
          code: 'handoff-target-incomplete',
          nodeId: node.id,
          detail: `entrega ${faltaNoAlvo(alvo)}`,
        })
      }
    }

    for (const nome of varsUsedIn(textoFalado(node))) {
      if (conhecidas.has(nome)) continue

      issues.push({
        code: 'unknown-var',
        nodeId: node.id,
        detail: `"{${nome}}" não é uma variável deste fluxo`,
      })
    }

    if (node.kind === 'question') {
      // O rótulo é o que o cliente lê na lista numerada, e o valor é o que a captura
      // guarda: opção sem um dos dois publica uma pergunta com linha em branco.
      node.options.forEach((option, index) => {
        if (option.label.trim() && option.value.trim()) return

        issues.push({
          code: 'option-label-missing',
          nodeId: node.id,
          detail: `opção ${index + 1} está sem rótulo`,
        })
      })

      // Vazio fora: duas opções em branco não são "valor repetido", e o aviso de rótulo
      // acima já cobre cada uma.
      const values = node.options
        .map(option => option.value)
        .filter(value => value.trim())
      const duplicated = values.filter(
        (value, index) => values.indexOf(value) !== index,
      )
      for (const value of new Set(duplicated)) {
        issues.push({
          code: 'duplicate-option-value',
          nodeId: node.id,
          detail: `valor "${value}" repetido entre as opções`,
        })
      }
    }
  }

  const escape = graph.settings.escapeTarget
  if (escape && !isTargetComplete(escape)) {
    issues.push({
      code: 'escape-target-incomplete',
      detail: `saída de emergência ${faltaNoAlvo(escape)}`,
    })
  }

  // A despedida do escape também é interpolada antes de sair para o cliente.
  for (const nome of varsUsedIn(graph.settings.escapeText ?? '')) {
    if (conhecidas.has(nome)) continue

    issues.push({
      code: 'unknown-var',
      detail: `saída de emergência: "{${nome}}" não é uma variável deste fluxo`,
    })
  }

  // Alcançabilidade só faz sentido com entrada e destinos válidos.
  if (issues.length > 0) return issues

  const reachable = reachableFrom(graph, graph.entryNodeId)

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        code: 'unreachable-node',
        nodeId: node.id,
        detail: 'nenhum caminho da entrada chega neste nó',
      })
    }
  }

  const hasTerminal = graph.nodes.some(
    node => reachable.has(node.id) && isTerminal(node),
  )
  if (!hasTerminal) {
    issues.push({
      code: 'no-terminal-reachable',
      detail: 'o fluxo nunca termina: nenhum handoff ou fim alcançável',
    })
  }

  // Exige que *nenhuma* saída leve a outro bloco: uma só voltando é laço legítimo
  // As duas saídas do bloco de horário são obrigatórias, não só uma.
  for (const node of graph.nodes) {
    if (node.kind !== 'schedule') continue

    const faltando = [
      node.whenOpen === node.id ? 'dentro do horário' : null,
      node.whenClosed === node.id ? 'fora do horário' : null,
    ].filter((lado): lado is string => lado !== null)

    if (faltando.length > 0) {
      issues.push({
        code: 'schedule-path-missing',
        nodeId: node.id,
        detail: `escolha o destino de: ${faltando.join(' e ')}`,
      })
    }
  }

  // ("repetir o menu"); todas voltando é destino nunca escolhido no editor.
  for (const node of graph.nodes) {
    const saidas = outgoing(node)
    // `schedule` já foi acusado acima, com o lado que falta.
    if (node.kind === 'schedule') continue
    if (saidas.length > 0 && saidas.every(target => target === node.id)) {
      issues.push({
        code: 'self-target',
        nodeId: node.id,
        detail: 'nenhuma saída deste bloco leva a outro: escolha os destinos',
      })
    }
  }

  for (const nodeId of findLoopWithoutWait(graph)) {
    issues.push({
      code: 'loop-without-wait',
      nodeId,
      detail: 'ciclo que não espera resposta — o bot giraria sozinho',
    })
  }

  return issues
}

/** Todo texto que o cliente lê neste bloco. */
function textoFalado(node: BotFlowGraph['nodes'][number]): string {
  // `condition` e `schedule` só desviam: não têm fala para interpolar.
  if (node.kind === 'condition' || node.kind === 'schedule') return ''
  if (node.kind === 'question') return `${node.text}\n${node.retryText ?? ''}`
  return node.text ?? ''
}

/** Alvo `queue` já é completo; os outros nascem sem canal nem atendente no editor. */
function isTargetComplete(target: HandoffTarget): boolean {
  if (target.type === 'line') return target.lineId.trim() !== ''
  if (target.type === 'evenly' || target.type === 'all') {
    return target.bitrixUserIds.some(id => id.trim() !== '')
  }
  return true
}

/** O que falta escolher, em uma frase. Prefixado pelo chamador. */
function faltaNoAlvo(target: HandoffTarget): string {
  return target.type === 'line'
    ? 'sem canal escolhido'
    : 'sem atendente escolhido'
}

function indexById(graph: BotFlowGraph): Map<NodeId, BotFlowGraph['nodes'][0]> {
  return new Map(graph.nodes.map(node => [node.id, node]))
}

function reachableFrom(graph: BotFlowGraph, entry: NodeId): Set<NodeId> {
  const porId = indexById(graph)
  const reachable = new Set<NodeId>([entry])
  // Cursor em vez de `shift()`, que realoca o array a cada passo.
  const queue: NodeId[] = [entry]

  for (let i = 0; i < queue.length; i += 1) {
    const atual = queue[i]
    const node = atual === undefined ? undefined : porId.get(atual)
    if (!node) continue

    for (const target of outgoing(node)) {
      if (reachable.has(target)) continue
      reachable.add(target)
      queue.push(target)
    }
  }

  return reachable
}

// Ciclo por `question`/`input` é normal (a re-pergunta), então nó de espera é tratado como
// sumidouro. Sem espera no ciclo, o `walk` gira até o teto de passos.
function findLoopWithoutWait(graph: BotFlowGraph): NodeId[] {
  const porId = indexById(graph)
  const visiting = new Set<NodeId>()
  const done = new Set<NodeId>()
  const found: NodeId[] = []

  const visit = (nodeId: NodeId): void => {
    if (done.has(nodeId)) return
    if (visiting.has(nodeId)) {
      found.push(nodeId)
      return
    }

    const node = porId.get(nodeId)
    if (!node) return

    visiting.add(nodeId)
    if (!isWaiting(node)) {
      for (const target of outgoing(node)) visit(target)
    }
    visiting.delete(nodeId)
    done.add(nodeId)
  }

  for (const node of graph.nodes) visit(node.id)

  return [...new Set(found)]
}
