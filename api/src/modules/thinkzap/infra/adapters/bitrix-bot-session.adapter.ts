import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { HandoffTarget } from '@/modules/thinkzap/domain/bot-flow/flow'
import {
  isTargetExecutable,
  transferParams,
} from '@/modules/thinkzap/domain/bot-flow/transfer-params'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import {
  BotSessionGoneError,
  isBotSessionGoneError,
  isSessionGoneCode,
  sessionErrorCode,
} from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { logThinkzapError } from '../../errors/catalog'

const log = createWorkerSourceLogger('bitrix')

// Fala pelo bot e não pelo conector de saída: a mensagem entra na sessão como do bot, fica
// no histórico que o operador lê no handoff, e não pega o prefixo de operador humano de
// `prepareOpenLineOutboundText`.
//
// O `botToken` vai como `CLIENT_ID` em `transfer` e `finish`; a doc não o lista em
// `message.send`, e a assimetria é dela.
export class BitrixBotSessionAdapter implements BotSessionPort {
  constructor(
    private readonly bitrixClient: BitrixClient,
    private readonly botToken: string,
  ) {}

  async say(chatId: string, text: string): Promise<void> {
    const method = 'imopenlines.bot.session.message.send'

    try {
      const response = await this.bitrixClient.callMethod(method, {
        CHAT_ID: chatId,
        NAME: 'DEFAULT',
        MESSAGE: text,
      })

      // Recusa por HTTP 200 com `error` no corpo não passa pelo `catch`. Sem isto, bot
      // fora da sessão contaria como fala entregue e o fluxo avançaria de nó.
      this.recusarSeForaDaSessao(method, chatId, response)
    } catch (err) {
      if (isBotSessionGoneError(err)) {
        // `warn`: o bot ter saído da conversa é desfecho normal (operador assumiu, sessão
        // fechou), e quem chama encerra a sessão em vez de retentar.
        logThinkzapError(
          log,
          'thinkzap.bot.say_session_gone',
          { chatId, code: err.code },
          { level: 'warn' },
        )
        throw err
      }

      // Sobe: fala perdida deixa o cliente sem a pergunta, e o worker decide o retry.
      logThinkzapError(
        log,
        'thinkzap.bot.say_failed',
        { chatId, err },
        { level: 'error' },
      )
      throw err
    }
  }

  /**
   * Converte recusa de participação em `BotSessionGoneError`, para o chamador distinguir
   * "não insista" de "tente de novo".
   */
  private recusarSeForaDaSessao(
    method: string,
    chatId: string,
    response: unknown,
  ): void {
    const code = sessionErrorCode(response)
    if (!code) return

    if (isSessionGoneCode(code)) {
      throw new BotSessionGoneError(method, code, chatId)
    }

    // Código desconhecido continua sendo falha: o log o nomeia para virar uma linha em
    // `SESSION_GONE_CODES` se for mais um jeito de dizer "bot fora da sessão".
    throw new Error(`Bitrix ${method}: recusou com ${code}`)
  }

  async handoff(chatId: string, target: HandoffTarget): Promise<void> {
    // A sessão roda um snapshot do grafo publicado, então o atendente escolhido pode ter
    // saído do portal depois. Fila em vez de abortar, senão a conversa fica parada num bot
    // que já se despediu.
    if (!isTargetExecutable(target)) {
      logThinkzapError(
        log,
        'thinkzap.bot.handoff_target_unusable',
        { chatId, targetType: target.type },
        { level: 'warn' },
      )
      return this.handoff(chatId, { type: 'queue' })
    }

    try {
      await this.bitrixClient.callMethod(
        'imopenlines.bot.session.transfer',
        transferParams(chatId, target, this.botToken),
      )
    } catch (err) {
      logThinkzapError(
        log,
        'thinkzap.bot.handoff_failed',
        { chatId, targetType: target.type, err },
        { level: 'error' },
      )
      throw err
    }
  }

  async finish(chatId: string): Promise<void> {
    try {
      await this.bitrixClient.callMethod('imopenlines.bot.session.finish', {
        CHAT_ID: chatId,
        CLIENT_ID: this.botToken,
      })
    } catch (err) {
      // Não sobe: a linha fecha a sessão por inatividade, e o fluxo já terminou.
      logThinkzapError(
        log,
        'thinkzap.bot.finish_failed',
        { chatId, err },
        { level: 'warn' },
      )
    }
  }
}
