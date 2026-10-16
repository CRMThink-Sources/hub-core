import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import { openChannelNotices } from '@/modules/thinkzap/domain/notices/open-channel-notices'

const log = createWorkerSourceLogger('bitrix')

/**
 * Avisa o operador, no próprio chat do canal aberto, que o envio de botões
 * disparado pela tela do widget falhou antes de chegar ao provider — código
 * malformado ou tipo de botão que a linha não aceita.
 *
 * Mirror de `notifyOperatorWindowClosed`: posta como o bot
 * (`imbot.message.add`), não via `imconnector.send.messages` — isso faria o
 * aviso aparecer como se o **contato** tivesse escrito. Nunca lança: o job já
 * vai encerrar sem retentativa (o motivo é permanente, retry não resolve), e
 * falhar aqui não pode transformar um aviso perdido em erro de processamento.
 */
export async function notifyOperatorButtonActionFailed(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
  /** Motivo como veio (validador) — só a parte fixa do aviso é traduzida. */
  reason: string,
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): Promise<void> {
  try {
    await bitrixClient.callMethod('imbot.message.add', {
      BOT_ID: botId,
      DIALOG_ID: `chat${bitrixChatId}`,
      MESSAGE: openChannelNotices(locale).buttonActionFailed(reason),
    })
    log.info(
      { bitrixChatId, buttonActionFailedNoticeSent: true },
      'Operator notified about failed button action',
    )
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.hubmessage.notify_failed',
      { bitrixChatId, err, buttonActionFailedNoticeFailed: true },
      {
        level: 'warn',
        msg: 'Failed to notify operator about failed button action',
      },
    )
  }
}
