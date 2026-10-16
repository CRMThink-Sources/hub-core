import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  describeSystemNoticeAttempts,
  postOpenChannelSystemNotice,
} from './post-open-channel-system-notice'

const log = createWorkerSourceLogger('bitrix')

export const DAILY_LIMIT_NOTICE =
  '⚠️ Sua mensagem não foi entregue: esta linha atingiu o limite diário de ' +
  'mensagens configurado no ThinkZap. Os envios voltam na virada do dia, ou ' +
  'antes, se o limite for aumentado ou um limite temporário for liberado na ' +
  'aba Ajustes da linha.'

export type DailyLimitNoticeOutcome =
  | { posted: true; method: string; bitrixMessageId: string }
  /** O que **cada** tentativa respondeu — é o que diz o que corrigir. */
  | { posted: false; reason: string }

/**
 * Avisa o operador, no chat do canal aberto, que a mensagem foi recusada pelo
 * limite diário da linha.
 *
 * Vai como **mensagem de sistema** (ver `postOpenChannelSystemNotice`), e não por
 * `imbot.message.add` direto: medido em staging (2026-10-16, `crmthinkers`, chat
 * 9500), o Bitrix recusa o bot do conector com `CANCELED — Você não pode enviar
 * mensagens para o bate-papo especificado`, porque ele não é participante da sessão
 * de canal aberto. A segunda tentativa, pelo usuário do app, é a que chega.
 *
 * Nunca lança: o job já vai encerrar sem retentativa. Devolve o desfecho para o
 * chamador registrar no log do job.
 */
export async function notifyOperatorDailyLimitReached(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
): Promise<DailyLimitNoticeOutcome> {
  const outcome = await postOpenChannelSystemNotice(bitrixClient, {
    botId,
    bitrixChatId,
    text: DAILY_LIMIT_NOTICE,
  })

  if (outcome.posted) {
    log.info(
      {
        bitrixChatId,
        botId,
        method: outcome.method,
        bitrixMessageId: outcome.bitrixMessageId,
        dailyLimitNoticeSent: true,
      },
      'Operator notified about daily send limit reached',
    )
    return {
      posted: true,
      method: outcome.method,
      bitrixMessageId: outcome.bitrixMessageId,
    }
  }

  const reason = describeSystemNoticeAttempts(outcome.attempts)

  logThinkzapError(
    log,
    'thinkzap.line.daily_limit_notify_failed',
    { bitrixChatId, botId, attempts: outcome.attempts },
    {
      level: 'warn',
      msg: 'Nenhum método do Bitrix aceitou o aviso de limite diário',
    },
  )

  return { posted: false, reason }
}
