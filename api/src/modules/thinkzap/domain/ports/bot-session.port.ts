import type { HandoffTarget } from '@/modules/thinkzap/domain/bot-flow/flow'

// `advance` é puro e só devolve efeitos; esta porta os executa.
export interface BotSessionPort {
  /** Texto puro: o canal não tem botão. */
  say(chatId: string, text: string): Promise<void>

  /** Vai ao chat do canal aberto sem chegar ao contato: contexto para quem vai assumir. */
  whisper(chatId: string, text: string): Promise<void>

  /** Termina a participação do bot: mensagem nova do cliente não volta para o fluxo. */
  handoff(chatId: string, target: HandoffTarget): Promise<void>

  finish(chatId: string): Promise<void>
}
