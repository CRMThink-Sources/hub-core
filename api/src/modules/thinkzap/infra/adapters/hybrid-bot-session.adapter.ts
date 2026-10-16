import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { HandoffTarget } from '@/modules/thinkzap/domain/bot-flow/flow'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import type { OutboundMessageSender } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { logThinkzapError } from '../../errors/catalog'
import { isDailyLimitReachedError } from '@/modules/thinkzap/application/helpers/send-within-daily-quota'

const log = createWorkerSourceLogger('bitrix')

/**
 * Entrega a fala do bot ao contato **e** ecoa no chat do canal aberto.
 *
 * Por que dois envios, e não um: medido em produção (2026-09-04, portal `crmthinkers`,
 * linha 230, chat 1822) que `imopenlines.bot.session.message.send` cria a mensagem no
 * chat do Bitrix e **não** dispara `ONIMCONNECTORMESSAGEADD` — o evento pelo qual o
 * ThinkZap entrega ao WhatsApp. A mensagem aparecia para o operador e nunca chegava ao
 * cliente.
 *
 * Então cada fala faz dois caminhos, com papéis distintos:
 *
 * - **contato**: pelo mesmo sender que o operador usa (`outboundSenderResolver` →
 *   Z-API/HubMessage). É a entrega que importa; falhar aqui é falhar o turno.
 * - **eco**: pelo adapter do bot no chat do canal aberto. É o histórico que o operador
 *   lê ao assumir a conversa; falhar aqui não perde a conversa, só o registro.
 *
 * `handoff` e `finish` seguem só pelo bot: são operações de sessão do canal aberto, não
 * mensagem ao contato.
 */
export class HybridBotSessionAdapter implements BotSessionPort {
  constructor(
    /** Faz o eco no chat do canal aberto — normalmente o `BitrixBotSessionAdapter`. */
    private readonly eco: BotSessionPort,
    private readonly contato: OutboundMessageSender,
    /** Registro da recusa por limite diário no log do job. Nunca deve lançar. */
    private readonly onDailyLimitReached: (
      chatId: string,
    ) => Promise<void> = () => Promise.resolve(),
  ) {}

  async say(chatId: string, text: string): Promise<void> {
    // Contato primeiro: é a entrega que não pode faltar, e o eco depois dela mantém o
    // histórico na ordem em que o cliente viu.
    try {
      await this.contato.send({ kind: 'text', text })
    } catch (err) {
      /**
       * Limite diário: a fala não sai e **também não é ecoada** — o histórico do chat
       * não pode mostrar ao operador algo que o contato nunca recebeu. Não relança:
       * retentar o turno cairia no mesmo limite.
       */
      if (isDailyLimitReachedError(err)) {
        logThinkzapError(
          log,
          'thinkzap.line.daily_limit_reached',
          { chatId },
          {
            level: 'warn',
            msg: 'Fala do bot não entregue: limite diário da linha atingido',
          },
        )
        await this.onDailyLimitReached(chatId)
        return
      }
      throw err
    }

    try {
      await this.eco.say(chatId, text)
    } catch (err) {
      // Não sobe: o cliente **já recebeu**. Propagar faria o worker retentar o turno e
      // mandar a mesma fala de novo ao contato.
      logThinkzapError(
        log,
        'thinkzap.bot.echo_failed',
        { chatId, err },
        { level: 'warn' },
      )
    }
  }

  /** Só pelo bot: o sussurro é para o operador, e mandá-lo ao contato o entregaria a quem não deve ver. */
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
