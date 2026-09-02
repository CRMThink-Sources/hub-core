import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Os **cinco** valores que `messageservice.message.status.update` aceita.
 *
 * Qualquer outro devolve `ERROR_MESSAGE_STATUS_INCORRECT` e a mensagem fica sem status
 * na tela do cliente — por isso o tipo é fechado aqui e não uma string livre.
 */
export type SmsMessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'

export type ReportSmsMessageStatusInput = {
  /** `CODE` do sender, como gravado na row do outbox. */
  senderCode: string
  /** `message_id` do Bitrix, como gravado na row do outbox. */
  messageId: string
  status: SmsMessageStatus
}

/**
 * Reporta ao Bitrix o desfecho de uma mensagem de campanha.
 *
 * **Nunca lança.** A mensagem já foi (ou não foi) entregue ao contato antes desta
 * chamada; o que se perde quando ela falha é um indicador na tela de campanha.
 * Propagar o erro faria o worker desfazer, reenfileirar ou marcar como falho um envio
 * que deu certo — no HubMessage, isso significa mensagem paga duplicada.
 *
 * **Não retenta**, pelo mesmo peso: uma fila própria para um dado cosmético custa mais
 * do que o dado vale. Fica o log, com o `CODE` e o `MESSAGE_ID`, para explicar depois
 * a campanha que ficou "enviando" na tela.
 */
export async function reportSmsMessageStatus(
  client: BitrixMethodCaller,
  input: ReportSmsMessageStatusInput,
): Promise<void> {
  try {
    await client.callMethod('messageservice.message.status.update', {
      CODE: input.senderCode,
      MESSAGE_ID: input.messageId,
      STATUS: input.status,
    })
  } catch (error) {
    apiLogger.warn(
      {
        app: 'thinkzap',
        source: 'bitrix',
        code: input.senderCode,
        messageId: input.messageId,
        status: input.status,
        err: error,
      },
      'falha ao reportar o status da mensagem de campanha ao Bitrix',
    )
  }
}
