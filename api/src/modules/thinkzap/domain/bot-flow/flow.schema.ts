import z from 'zod'
import {
  type BotFlowGraph,
  DEFAULT_FLOW_SETTINGS,
  type NodeId,
  isTerminal,
  isWaiting,
  outgoing,
} from './flow'

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

/** Identificador simples: a variável é interpolada em texto e comparada em condição. */
const VAR_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

const messageNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('message'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: requiredTextSchema,
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
        value: z.string().min(1),
        label: z.string().min(1),
        next: nodeIdSchema,
      }),
    )
    .min(1)
    // As opções saem numeradas em texto puro no WhatsApp, sem botão: o teto evita a
    // mensagem-parede.
    .max(MAX_QUESTION_OPTIONS),
  saveAs: varNameSchema.optional(),
  retryText: z.string().min(1).optional(),
  maxAttempts: z.number().int().min(1).max(10),
  onExhausted: nodeIdSchema,
})

const inputNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('input'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: requiredTextSchema,
  saveAs: varNameSchema,
  validate: z.enum(['text', 'email', 'cpf', 'number', 'date']),
  retryText: z.string().min(1).optional(),
  next: nodeIdSchema,
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
})

const handoffNodeSchema = z.object({
  id: nodeIdSchema,
  kind: z.literal('handoff'),
  position: positionSchema,
  portSides: portSidesSchema,
  name: nodeNameSchema,
  text: optionalTextSchema,
  // Sem `min(1)` nos ids: o editor grava o alvo antes de escolher o atendente. Alvo sem
  // id é `handoff-target-incomplete` em `validateFlowGraph`, que aponta o nó.
  target: z.discriminatedUnion('type', [
    z.object({ type: z.literal('queue') }),
    z.object({ type: z.literal('user'), bitrixUserId: z.string() }),
    z.object({ type: z.literal('line'), lineId: z.string() }),
  ]),
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
  inputNodeSchema,
  conditionNodeSchema,
  handoffNodeSchema,
  finishNodeSchema,
])

const flowSettingsSchema = z.object({
  escapeKeywords: z.array(z.string().min(1)).max(20),
  escapeNext: nodeIdSchema.nullable(),
})

export const botFlowGraphSchema = z.object({
  entryNodeId: nodeIdSchema,
  // Sem teto de blocos: quem protege o worker é `MAX_STEPS` em `advance`, que limita
  // passos por mensagem e não tamanho do fluxo.
  nodes: z.array(flowNodeSchema).min(1),
  // Fábrica, não o objeto: referência compartilhada faria todos os fluxos parseados
  // apontarem para o mesmo `escapeKeywords`.
  settings: flowSettingsSchema.default(() => ({
    ...DEFAULT_FLOW_SETTINGS,
    escapeKeywords: [...DEFAULT_FLOW_SETTINGS.escapeKeywords],
  })),
})

export type FlowIssueCode =
  | 'malformed'
  | 'duplicate-node-id'
  | 'entry-not-found'
  | 'target-not-found'
  | 'unreachable-node'
  | 'loop-without-wait'
  | 'no-terminal-reachable'
  | 'escape-target-not-found'
  | 'duplicate-option-value'
  | 'self-target'
  | 'handoff-target-incomplete'
  | 'condition-var-invalid'
  | 'node-text-missing'

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
      (node.kind === 'message' ||
        node.kind === 'question' ||
        node.kind === 'input') &&
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
        }
      })
    }

    if (node.kind === 'handoff') {
      const alvo = node.target
      const idFaltando =
        (alvo.type === 'user' && !alvo.bitrixUserId.trim()) ||
        (alvo.type === 'line' && !alvo.lineId.trim())

      if (idFaltando) {
        issues.push({
          code: 'handoff-target-incomplete',
          nodeId: node.id,
          detail:
            alvo.type === 'user'
              ? 'entrega para atendente sem atendente escolhido'
              : 'entrega para canal aberto sem canal escolhido',
        })
      }
    }

    if (node.kind === 'question') {
      const values = node.options.map(option => option.value)
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

  if (graph.settings.escapeNext && !seen.has(graph.settings.escapeNext)) {
    issues.push({
      code: 'escape-target-not-found',
      detail: `destino da palavra de escape "${graph.settings.escapeNext}" não existe`,
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
  // ("repetir o menu"); todas voltando é destino nunca escolhido no editor.
  for (const node of graph.nodes) {
    const saidas = outgoing(node)
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
