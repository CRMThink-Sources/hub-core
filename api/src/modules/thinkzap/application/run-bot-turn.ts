import {
  advance,
  collapseSays,
  type BotEffect,
  type BotSessionState,
} from '@/modules/thinkzap/domain/bot-flow/advance'
import type { ParsedBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import { isBotSessionGoneError } from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { isTargetExecutable } from '@/modules/thinkzap/domain/bot-flow/transfer-params'
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

// Casado com o `WELCOME_BOT_TIME` do vínculo: passado esse tempo o Bitrix já tirou o bot
// da conversa, e a próxima mensagem é atendimento novo.
const SESSION_TTL_SECONDS = 3600

/**
 * Janela em que um `join` é considerado eco do início que já rodou.
 *
 * Medido 4 ms entre os dois eventos; 30 s cobre atraso de fila e retry sem alcançar
 * `join` legítimo, que só acontece quando alguém recoloca o bot numa conversa parada.
 */
const JOIN_ECHO_WINDOW_MS = 30_000

/**
 * Quanto tempo o bot fica calado num chat que já foi entregue a um atendente.
 *
 * O handoff fecha a sessão, e `getActiveByChatId` só vê `ACTIVE`: sem esta janela a
 * mensagem seguinte do cliente não encontrava sessão, abria uma nova pelo vínculo da linha
 * e o bot recomeçava o fluxo do zero por cima do atendimento humano.
 *
 * 12 h e não o TTL da sessão: o prazo que importa é o do atendimento que começou ali, não
 * o da conversa do bot que acabou. Quem reabre antes disso é o `join` — o Bitrix dizendo
 * que recolocou o bot numa conversa nova.
 */
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
    }
  /** Bot fora do chat: sessão encerrada, sem retry. Não é falha do job. */
  | { kind: 'gone'; code: string }
  /**
   * Chat já entregue a um atendente. Nada a fazer — e, ao contrário de `skipped`, não
   * transferir de novo: a conversa já está com quem a assumiu.
   */
  | { kind: 'entregue'; desde: Date }
  /** Evento repetido do mesmo início de conversa. Nada a fazer, e não é erro. */
  | { kind: 'duplicado'; reason: 'join-eco' }

export type RunBotTurnDeps = {
  session: BotSessionPort
  sessions: GetActiveBotSessionRepository &
    GetHandedOffBotSessionRepository &
    CreateBotSessionRepository &
    UpdateBotSessionRepository
  flows: GetBotFlowRepository
  bindings: GetBotFlowBindingByLineRepository
  /** Injetado para o teste fixar o prazo sem mexer no relógio do processo. */
  now?: () => Date
}

// Um turno da conversa: evento do portal → falas do bot → novo estado da sessão.
export async function runBotTurn(
  event: ParsedBotEvent,
  lineId: string,
  appId: string,
  deps: RunBotTurnDeps,
  // Vínculos de CRM do chat, do `entity_data_2` de `dialog.get`. O bloco de condição
  // pronto do editor os compara, então o fluxo já decide no primeiro passo.
  crmVars: Record<string, string> = {},
): Promise<BotTurnOutcome> {
  const agora = deps.now?.() ?? new Date()
  const expiresAt = new Date(agora.getTime() + SESSION_TTL_SECONDS * 1000)

  const existente = await deps.sessions.getActiveByChatId(appId, event.chatId)

  /**
   * Fala do cliente num chat já entregue não é conversa nova com o bot: é ele respondendo
   * ao atendente.
   *
   * Só quando não há sessão viva, que é o caso em que o fluxo recomeçaria, e só para
   * `message` — o `join` continua recomeçando, porque é o Bitrix dizendo que recolocou o
   * bot numa conversa nova.
   */
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

  // A sessão viva roda o snapshot dela, não o fluxo atual: o vínculo só é consultado para
  // sessão nova, então quem já está respondendo termina no fluxo em que começou.
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

  /**
   * O `join` que chega depois de a sessão já ter começado é eco, não conversa nova.
   *
   * O Bitrix dispara `ONIMBOTV2MESSAGEADD` e `ONIMBOTV2JOINCHAT` no mesmo instante
   * quando o contato abre a conversa — medido em produção com 4 ms entre os dois, e em
   * ordem invertida. Os dois rodavam o fluxo do início e o cliente recebia a saudação
   * duplicada.
   *
   * Só o `join` é descartado, nunca o `message`: descartar a fala perderia o que o
   * cliente escreveu. E a janela é curta de propósito — `join` legítimo (bot recolocado
   * numa conversa antiga) tem de continuar recomeçando.
   */
  if (
    event.kind === 'join' &&
    existente &&
    agora.getTime() - existente.createdAt.getTime() < JOIN_ECHO_WINDOW_MS
  ) {
    return { kind: 'duplicado', reason: 'join-eco' }
  }

  // `join` sempre recomeça: o Bitrix está dizendo que o bot entrou numa sessão nova, então
  // sessão pendente do mesmo chat é resto de conversa anterior.
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
    crmVars,
  )

  const effects = collapseSays(resultado.effects)

  // Grava o estado antes de falar: se falasse primeiro e a gravação caísse, o cliente
  // teria a pergunta na tela e a sessão apontaria para o nó anterior, lendo a resposta
  // dele como resposta da pergunta velha.
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
      /**
       * Transferência que não confirmou não pode ficar gravada como entrega.
       *
       * O estado é gravado antes da entrega, então neste ponto a sessão já está
       * `HANDED_OFF` — e a guarda de reinício leria isso como atendimento humano em curso,
       * deixando o retry deste job mudo e a conversa sem bot e sem atendente. `ABORTED`
       * diz o que de fato aconteceu: o fluxo chegou ao fim e a entrega não saiu.
       */
      if (fechada && effects.some(effect => effect.kind === 'handoff')) {
        await deps.sessions.close(fechada, 'ABORTED')
      }

      throw err
    }

    // O bot não participa mais do chat (operador assumiu, sessão fechou no portal).
    // Encerrar em vez de propagar: o retry repetiria uma chamada que nunca vai passar e
    // deixaria a sessão `ACTIVE`, prendendo o chat até o TTL.
    if (sessaoId) await deps.sessions.close(sessaoId, 'EXPIRED')

    return { kind: 'gone', code: err.code }
  }

  return { kind: 'ran', effects }
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

  // Bot na linha sem vínculo nosso (`unbind` falhou, ou apagaram direto no banco): quem
  // chama transfere para a fila.
  if (!binding) return { reason: 'sem-vinculo' }
  if (!binding.active) return { reason: 'vinculo-inativo' }

  const flow = await deps.flows.getById(appId, binding.flowId)
  if (!flow) return { reason: 'fluxo-ausente' }
  if (flow.status !== 'PUBLISHED') return { reason: 'fluxo-nao-publicado' }

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
  // `ativa`: a sessão que ficou `ACTIVE`, que é a que o `say` pode derrubar. `fechada`: a
  // que este turno encerrou, e que a entrega falha precisa poder remarcar. Sem os dois ids
  // não há como consertar nenhum dos casos.
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

  // Fluxo que termina no primeiro passo não cria sessão: uma row `ACTIVE` sem próximo nó
  // bloquearia o chat até expirar.
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

    if (effect.kind === 'handoff') {
      // Alvo incompleto só é detectável aqui: a publicação valida o grafo, mas o operador
      // pode ter saído do portal depois. Fila em vez de id inexistente.
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

    // `abort` é fluxo quebrado em runtime (nó inexistente, laço): fila em vez de chat mudo.
    await deps.session.handoff(chatId, { type: 'queue' })
  }
}
