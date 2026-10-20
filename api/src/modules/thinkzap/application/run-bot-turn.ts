import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  advance,
  collapseSays,
  type BotEffect,
  type BotSessionState,
} from '@/modules/thinkzap/domain/bot-flow/advance'
import type { ParsedBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import { isBotSessionGoneError } from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { isTargetExecutable } from '@/modules/thinkzap/domain/bot-flow/transfer-params'
import { WORKING_HOURS_VAR } from '@/modules/thinkzap/domain/bot-flow/vars'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import type {
  BotSession,
  CreateBotSessionRepository,
  GetActiveBotSessionRepository,
  GetHandedOffBotSessionRepository,
  UpdateBotSessionRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-session.repository'
import type { GetBotFlowRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import type { GetBotFlowBindingByLineRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'

// Casado com o `WELCOME_BOT_TIME` do vínculo.
const SESSION_TTL_SECONDS = 3600

// `join` dentro desta janela é eco do início (medido: 4 ms); 30 s cobre fila e retry.
const JOIN_ECHO_WINDOW_MS = 30_000

// Bot calado após handoff: sem isto, a próxima mensagem abria sessão nova por cima do
// atendente. Só `join` reabre antes do prazo.
const HANDOFF_MUTE_MS = 12 * 60 * 60 * 1000

export type BotTurnOutcome =
  | { kind: 'ran'; effects: BotEffect[] }
  | {
      kind: 'skipped'
      reason:
        | 'sem-vinculo'
        | 'vinculo-inativo'
        | 'fluxo-ausente'
        | 'fluxo-nao-publicado'
        | 'sem-conector-ativo'
    }
  /** Bot fora do chat: sessão encerrada, sem retry. */
  | { kind: 'gone'; code: string }
  /** Chat já com atendente: não transferir de novo. */
  | { kind: 'entregue'; desde: Date }
  | { kind: 'duplicado'; reason: 'join-eco' }

export type RunBotTurnDeps = {
  session: BotSessionPort
  sessions: GetActiveBotSessionRepository &
    GetHandedOffBotSessionRepository &
    CreateBotSessionRepository &
    UpdateBotSessionRepository
  flows: GetBotFlowRepository
  bindings: GetBotFlowBindingByLineRepository
  /** Só consultado ao abrir sessão: a que está em curso termina. */
  connectorAtivo: () => Promise<boolean>
  /** `null` = não deu para saber. */
  workingHours?: (lineId: string) => Promise<boolean | null>
  now?: () => Date
  /** Idioma da instalação, para o texto fixo do resumo na transferência. Ausente, `pt`. */
  locale?: NoticeLocale
}

// Um turno da conversa: evento do portal → falas do bot → novo estado da sessão.
export async function runBotTurn(
  event: ParsedBotEvent,
  lineId: string,
  appId: string,
  deps: RunBotTurnDeps,
  // Do `entity_data_2` de `dialog.get`.
  crmVars: Record<string, string> = {},
): Promise<BotTurnOutcome> {
  const agora = deps.now?.() ?? new Date()
  const expiresAt = new Date(agora.getTime() + SESSION_TTL_SECONDS * 1000)

  const existente = await deps.sessions.getActiveByChatId(appId, event.chatId)

  // Mensagem em chat já entregue é resposta ao atendente; `join` segue recomeçando.
  if (!existente && event.kind === 'message') {
    const entregueEm = await deps.sessions.handoffAtByChatId(
      appId,
      event.chatId,
    )

    if (
      entregueEm &&
      agora.getTime() - entregueEm.getTime() < HANDOFF_MUTE_MS
    ) {
      return { kind: 'entregue', desde: entregueEm }
    }
  }

  // Sessão viva roda o snapshot dela: termina no fluxo em que começou.
  const contexto = existente
    ? {
        flowId: existente.flowId,
        flowVersion: existente.flowVersion,
        graph: existente.graph,
        bindingId: existente.bindingId,
      }
    : await resolveNovaSessao(appId, lineId, deps)

  if ('reason' in contexto) {
    return { kind: 'skipped', reason: contexto.reason }
  }

  // `MESSAGEADD` e `JOINCHAT` chegam juntos na abertura e duplicavam a saudação. Descarta
  // só o `join`: descartar `message` perderia a fala do cliente.
  if (
    event.kind === 'join' &&
    existente &&
    agora.getTime() - existente.createdAt.getTime() < JOIN_ECHO_WINDOW_MS
  ) {
    return { kind: 'duplicado', reason: 'join-eco' }
  }

  // `join` sempre recomeça: sessão pendente é resto de conversa anterior.
  const estadoAnterior: BotSessionState | null =
    event.kind === 'join' || !existente
      ? null
      : {
          currentNodeId: existente.currentNodeId,
          vars: existente.vars,
          attempts: existente.attempts,
        }

  const resultado = advance(
    contexto.graph,
    estadoAnterior,
    event.kind === 'join'
      ? { kind: 'start' }
      : { kind: 'text', text: event.text },
    await comHorarioDeAtendimento(crmVars, contexto.graph, lineId, deps),
    deps.locale,
  )

  const effects = collapseSays(resultado.effects)

  // Grava antes de falar: senão, falha na gravação leria a resposta contra a pergunta velha.
  const { ativa: sessaoId, fechada } = await persistirEstado({
    appId,
    event,
    contexto,
    existente,
    resultado,
    expiresAt,
    deps,
  })

  try {
    await entregarEfeitos(effects, event.chatId, deps)
  } catch (err) {
    if (!isBotSessionGoneError(err)) {
      // Handoff que falhou não pode ficar `HANDED_OFF`: o retry ficaria mudo.
      if (fechada && effects.some(effect => effect.kind === 'handoff')) {
        await deps.sessions.close(fechada, 'ABORTED')
      }

      throw err
    }

    // Bot fora do chat: retry nunca passaria e prenderia a sessão `ACTIVE` até o TTL.
    if (sessaoId) await deps.sessions.close(sessaoId, 'EXPIRED')

    return { kind: 'gone', code: err.code }
  }

  return { kind: 'ran', effects }
}

/** Falha na consulta segue como dentro do horário. */
async function comHorarioDeAtendimento(
  vars: Record<string, string>,
  graph: BotSession['graph'],
  lineId: string,
  deps: RunBotTurnDeps,
): Promise<Record<string, string>> {
  if (!deps.workingHours) return vars
  if (!graph.nodes.some(node => node.kind === 'schedule')) return vars

  const dentro = await deps.workingHours(lineId).catch(() => null)
  if (dentro === null) return vars

  return { ...vars, [WORKING_HOURS_VAR]: dentro ? 'Y' : 'N' }
}

type Contexto = {
  flowId: string
  flowVersion: number
  graph: BotSession['graph']
  bindingId: string | null
}

async function resolveNovaSessao(
  appId: string,
  lineId: string,
  deps: RunBotTurnDeps,
): Promise<
  Contexto | { reason: Extract<BotTurnOutcome, { kind: 'skipped' }>['reason'] }
> {
  const binding = await deps.bindings.getByLineId(appId, lineId)

  if (!binding) return { reason: 'sem-vinculo' }
  if (!binding.active) return { reason: 'vinculo-inativo' }

  const flow = await deps.flows.getById(appId, binding.flowId)
  if (!flow) return { reason: 'fluxo-ausente' }
  if (flow.status !== 'PUBLISHED') return { reason: 'fluxo-nao-publicado' }

  // Por último: lê o CRM.
  if (!(await deps.connectorAtivo())) return { reason: 'sem-conector-ativo' }

  return {
    flowId: flow.id,
    flowVersion: flow.version,
    graph: flow.graph,
    bindingId: binding.id,
  }
}

async function persistirEstado(input: {
  appId: string
  event: ParsedBotEvent
  contexto: Contexto
  existente: BotSession | null
  resultado: ReturnType<typeof advance>
  expiresAt: Date
  deps: RunBotTurnDeps
  // `ativa`: a que o `say` pode derrubar. `fechada`: a que a entrega falha remarca.
}): Promise<{ ativa: string | null; fechada: string | null }> {
  const { appId, event, contexto, existente, resultado, expiresAt, deps } =
    input
  const proximo = resultado.state

  if (existente) {
    if (proximo) {
      await deps.sessions.advance(existente.id, {
        currentNodeId: proximo.currentNodeId,
        vars: proximo.vars,
        attempts: proximo.attempts,
        expiresAt,
      })
      return { ativa: existente.id, fechada: null }
    }

    await deps.sessions.close(existente.id, statusFinal(resultado.effects))
    return { ativa: null, fechada: existente.id }
  }

  // Sem próximo nó, `ACTIVE` prenderia o chat até expirar.
  if (!proximo) return { ativa: null, fechada: null }

  const criada = await deps.sessions.create({
    appId,
    bitrixChatId: event.chatId,
    flowId: contexto.flowId,
    flowVersion: contexto.flowVersion,
    graph: contexto.graph,
    bindingId: contexto.bindingId,
    currentNodeId: proximo.currentNodeId,
    vars: proximo.vars,
    attempts: proximo.attempts,
    expiresAt,
  })

  return { ativa: criada.id, fechada: null }
}

function statusFinal(
  effects: BotEffect[],
): 'HANDED_OFF' | 'FINISHED' | 'ABORTED' {
  if (effects.some(e => e.kind === 'handoff')) return 'HANDED_OFF'
  if (effects.some(e => e.kind === 'abort')) return 'ABORTED'
  return 'FINISHED'
}

async function entregarEfeitos(
  effects: BotEffect[],
  chatId: string,
  deps: RunBotTurnDeps,
): Promise<void> {
  for (const effect of effects) {
    if (effect.kind === 'say') {
      await deps.session.say(chatId, effect.text)
      continue
    }

    if (effect.kind === 'whisper') {
      await deps.session.whisper(chatId, effect.text)
      continue
    }

    if (effect.kind === 'handoff') {
      // Operador pode ter saído do portal após a publicação: fila em vez de id inexistente.
      await deps.session.handoff(
        chatId,
        isTargetExecutable(effect.target)
          ? effect.target
          : { type: 'queue' as const },
      )
      continue
    }

    if (effect.kind === 'finish') {
      await deps.session.finish(chatId)
      continue
    }

    // `abort` = fluxo quebrado em runtime: fila em vez de chat mudo.
    await deps.session.handoff(chatId, { type: 'queue' })
  }
}
