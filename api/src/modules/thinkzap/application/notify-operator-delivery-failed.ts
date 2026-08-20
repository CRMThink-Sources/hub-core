import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  describeSystemNoticeAttempts,
  postOpenChannelSystemNotice,
} from './post-open-channel-system-notice'

const log = createWorkerSourceLogger('hubmessage')

export type NotifyOutcome =
  | { posted: true; bitrixMessageId: string; method: string }
  /** `reason` traz o que **cada** tentativa respondeu — é o que diz o que corrigir. */
  | { posted: false; reason: string }

/**
 * Avisa o operador, no chat do canal aberto onde ele escreveu, que a mensagem foi
 * **aceita pela HubMessage e recusada pela Meta** depois disso.
 *
 * É o único lugar onde essa informação pode aparecer: o
 * `imconnector.send.status.delivery` já marcou a mensagem como entregue no aceite, e o
 * Bitrix não expõe des-entregar.
 *
 * Vai como **mensagem de sistema** (ver `postOpenChannelSystemNotice`): aviso de
 * conector não é fala de operador nem de contato.
 *
 * **Devolve o desfecho em vez de presumir sucesso.** `callMethod` só lança quando o
 * transporte falha; o Bitrix recusa com HTTP 200 e `error` no corpo, e sem olhar a
 * resposta o log afirmava "aviso postado" para uma chamada que não criou mensagem
 * nenhuma — exatamente o silêncio que este aviso existe para acabar.
 *
 * Nunca lança: o desfecho da mensagem já aconteceu e nenhuma retentativa muda — falhar
 * aqui só transformaria um aviso perdido em job falho que a fila reprocessa para chegar
 * ao mesmo lugar.
 */
export async function notifyOperatorDeliveryFailed(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
  notice: string,
): Promise<NotifyOutcome> {
  const outcome = await postOpenChannelSystemNotice(bitrixClient, {
    botId,
    bitrixChatId,
    text: notice,
  })

  if (outcome.posted) {
    log.info(
      {
        bitrixChatId,
        botId,
        method: outcome.method,
        bitrixMessageId: outcome.bitrixMessageId,
        deliveryFailedNoticeSent: true,
      },
      'Operator notified about delivery failure',
    )
    return {
      posted: true,
      bitrixMessageId: outcome.bitrixMessageId,
      method: outcome.method,
    }
  }

  const reason = describeSystemNoticeAttempts(outcome.attempts)

  logThinkzapError(
    log,
    'thinkzap.hubmessage.notify_failed',
    {
      bitrixChatId,
      botId,
      attempts: outcome.attempts,
      deliveryFailedNoticeFailed: true,
    },
    {
      level: 'warn',
      msg: 'Nenhum método do Bitrix aceitou a mensagem de sistema do aviso',
    },
  )

  return { posted: false, reason }
}
