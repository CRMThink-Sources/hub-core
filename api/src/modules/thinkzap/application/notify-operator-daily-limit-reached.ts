import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

const log = createWorkerSourceLogger('bitrix')

const DAILY_LIMIT_NOTICE =
  '⚠️ Sua mensagem não foi entregue: esta linha atingiu o limite diário de ' +
  'mensagens configurado no ThinkZap. Os envios voltam na virada do dia, ou ' +
  'antes, se o limite for aumentado ou um limite temporário for liberado na ' +
  'aba Ajustes da linha.'

/**
 * Avisa o operador, no chat do canal aberto, que a mensagem foi recusada pelo
 * limite diário da linha. Mesmo molde de `notifyOperatorWindowClosed`: posta como
 * o bot, para o aviso não aparecer como fala do contato.
 *
 * Nunca lança: o job já vai encerrar sem retentativa.
 */
export async function notifyOperatorDailyLimitReached(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
): Promise<void> {
  try {
    await bitrixClient.callMethod('imbot.message.add', {
      BOT_ID: botId,
      DIALOG_ID: `chat${bitrixChatId}`,
      MESSAGE: DAILY_LIMIT_NOTICE,
    })
    log.info(
      { bitrixChatId, dailyLimitNoticeSent: true },
      'Operator notified about daily send limit reached',
    )
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.line.daily_limit_notify_failed',
      { bitrixChatId, err },
      {
        level: 'warn',
        msg: 'Failed to notify operator about daily send limit reached',
      },
    )
  }
}
