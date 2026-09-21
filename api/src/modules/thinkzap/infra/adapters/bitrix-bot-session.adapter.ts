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
    /** `botId` do portal. Exigido por `imbot.v2.Chat.Message.send`. */
    private readonly bitrixBotId: number,
  ) {}

  /**
   * `imbot.v2.Chat.Message.send`, e **não** `imopenlines.bot.session.message.send`.
   *
   * Medido em produção (2026-09-04, portal `crmthinkers`, linha 210): o método de
   * `bot.session` cria a mensagem como **automática da linha** — ela aparece cinza no
   * chat, sem autor, e o Bitrix não a entrega ao conector. O cliente nunca recebia.
   *
   * Este método manda como fala do bot participante. `system` tem default `false`, e é
   * mensagem não-sistema que o canal aberto repassa ao conector — o par
   * `SKIP_CONNECTOR` do `imbot.message.add` (v1) documenta que atravessar é o padrão.
   *
   * `dialogId` é `chat<CHAT_ID>`: o método fala em diálogo, não em sessão de linha.
   */
  async say(chatId: string, text: string): Promise<void> {
    const method = 'imbot.v2.Chat.Message.send'

    try {
      const response = await this.bitrixClient.callMethod(method, {
        botId: this.bitrixBotId,
        botToken: this.botToken,
        dialogId: `chat${chatId}`,
        fields: {
          message: text,
          // Explícito mesmo sendo o default: é o campo que decide se o conector recebe.
          system: false,
        },
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

    const method = 'imopenlines.bot.session.transfer'

    try {
      const response = await this.bitrixClient.callMethod(
        method,
        transferParams(chatId, target, this.botToken),
      )

      /**
       * Mesma checagem do `say`, e pelo mesmo motivo: o REST do Bitrix recusa com HTTP
       * 200 e `error` no corpo, que não passa pelo `catch`.
       *
       * Sem isto a recusa contava como transferência feita: o `LEAVE: 'Y'` nunca rodava,
       * o bot seguia no chat recebendo os eventos do contato, e o único registro do
       * handoff era a sessão que fechamos como `HANDED_OFF` do nosso lado.
       */
      this.recusarSeForaDaSessao(method, chatId, response)
    } catch (err) {
      logThinkzapError(
        log,
        'thinkzap.bot.handoff_failed',
        { chatId, targetType: target.type, err },
        // Bot já fora da conversa é desfecho normal — quem assumiu está com ela, e quem
        // chama encerra a sessão em vez de retentar.
        { level: isBotSessionGoneError(err) ? 'warn' : 'error' },
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
