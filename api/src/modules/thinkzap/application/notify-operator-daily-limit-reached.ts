import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
  dailyLimitNotices,
} from '@/modules/thinkzap/domain/daily-limit-notices'
import {
  describeSystemNoticeAttempts,
  postOpenChannelSystemNotice,
} from './post-open-channel-system-notice'

const log = createWorkerSourceLogger('bitrix')

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
 * O texto sai no idioma da instalação (`core_apps.locale`); sem escolha, português.
 *
 * Nunca lança: o job já vai encerrar sem retentativa. Devolve o desfecho para o
 * chamador registrar no log do job.
 */
export async function notifyOperatorDailyLimitReached(
  bitrixClient: BitrixClient,
  botId: number,
  bitrixChatId: string,
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): Promise<DailyLimitNoticeOutcome> {
  const outcome = await postOpenChannelSystemNotice(bitrixClient, {
    botId,
    bitrixChatId,
    text: dailyLimitNotices(locale).chat,
  })

  if (outcome.posted) {
    log.info(
      {
        bitrixChatId,
        botId,
        method: outcome.method,
        bitrixMessageId: outcome.bitrixMessageId,
        locale,
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
