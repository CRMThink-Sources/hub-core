import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('hubmessage')

const WINDOW_CLOSED_NOTICE =
  '⚠️ Sua mensagem não foi entregue: o contato não interage há mais de 24 horas ' +
  'e o WhatsApp Oficial só permite mensagem livre dentro dessa janela. ' +
  'Para retomar a conversa, é preciso enviar um template aprovado.'

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
): Promise<void> {
  try {
    await bitrixClient.callMethod('imbot.message.add', {
      BOT_ID: botId,
      DIALOG_ID: `chat${bitrixChatId}`,
      MESSAGE: WINDOW_CLOSED_NOTICE,
    })
    log.info(
      { bitrixChatId, windowClosedNoticeSent: true },
      'Operator notified about closed 24h window',
    )
  } catch (err) {
    log.warn(
      { bitrixChatId, err, windowClosedNoticeFailed: true },
      'Failed to notify operator about closed 24h window',
    )
  }
}
