import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import { openChannelNotices } from '@/modules/thinkzap/domain/notices/open-channel-notices'

const log = createWorkerSourceLogger('hubmessage')

/**
 * Avisa o operador, no próprio chat do canal aberto, que a mensagem não foi
 * entregue por janela de 24h fechada.
 *
 * Posta como o bot (`imbot.message.add`) e não via `imconnector.send.messages`:
 * este último faria o aviso aparecer como se o CONTATO tivesse escrito,
 * poluindo o histórico com texto que ele nunca enviou.
 *
 * Nunca lança: o job já vai encerrar sem retentativa, e falhar aqui não deve
 * transformar um aviso perdido em erro de processamento.
 */
export async function notifyOperatorWindowClosed(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
  /** Idioma da instalação; o texto vem do catálogo `open-channel-notices`. */
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): Promise<void> {
  try {
    await bitrixClient.callMethod('imbot.message.add', {
      BOT_ID: botId,
      DIALOG_ID: `chat${bitrixChatId}`,
      MESSAGE: openChannelNotices(locale).windowClosed,
    })
    log.info(
      { bitrixChatId, windowClosedNoticeSent: true },
      'Operator notified about closed 24h window',
    )
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.hubmessage.notify_failed',
      { bitrixChatId, err, windowClosedNoticeFailed: true },
      {
        level: 'warn',
        msg: 'Failed to notify operator about closed 24h window',
      },
    )
  }
}
