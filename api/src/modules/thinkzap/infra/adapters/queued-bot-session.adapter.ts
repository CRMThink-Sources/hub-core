import type { HandoffTarget } from '@/modules/thinkzap/domain/bot-flow/flow'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'

/**
 * A sessão do bot no caminho unificado: a fala vai para a fila de saída da linha
 * (`enqueue`) e retorna sem esperar o envio. O eco no chat do canal aberto é feito
 * pelo despacho, **depois** da entrega ao contato.
 *
 * Sussurro, transferência e encerramento seguem direto pelo bot: são operações da
 * sessão do canal aberto, não mensagens ao contato — não passam pela cadência.
 */
export class QueuedBotSessionAdapter implements BotSessionPort {
  constructor(
    private readonly eco: BotSessionPort,
    private readonly enqueue: (chatId: string, text: string) => Promise<void>,
  ) {}

  async say(chatId: string, text: string): Promise<void> {
    await this.enqueue(chatId, text)
  }

  async whisper(chatId: string, text: string): Promise<void> {
    return this.eco.whisper(chatId, text)
  }

  async handoff(chatId: string, target: HandoffTarget): Promise<void> {
    return this.eco.handoff(chatId, target)
  }

  async finish(chatId: string): Promise<void> {
    return this.eco.finish(chatId)
  }
}
