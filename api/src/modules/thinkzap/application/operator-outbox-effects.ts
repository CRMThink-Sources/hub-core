import { cadenceNotices } from '@/modules/thinkzap/domain/notices/cadence-notices'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import type { CadenceDeferral } from './dispatch-widget-outbox-message'
import {
  OperatorOriginContext,
  isOperatorOriginContext,
} from './enqueue-operator-reply'
import type { WidgetSendOutcome } from './notify-widget-send-outcome'

const PERSISTED_TYPE = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  document: 'DOCUMENT',
} as const

export type OperatorDeliveryDeps = {
  persist: (input: {
    instanceId: string
    providerMessageId: string
    bitrixMessageId: string
    bitrixChatId: string
    chatId: string
    bitrixUserId: string
    type:
      | 'TEXT'
      | 'IMAGE'
      | 'VIDEO'
      | 'AUDIO'
      | 'DOCUMENT'
      | 'INTERACTIVE_BUTTON'
    text: string | null
    fileName: string | null
  }) => Promise<void>
  /** `imconnector.send.status.delivery` da mensagem do operador. */
  setDelivered: (
    context: OperatorOriginContext,
    providerMessageId: string,
  ) => Promise<void>
}

/**
 * Depois da entrega de uma resposta do operador: o histórico com o id do Bitrix
 * (é por ele que a citação e o espelhamento acham a mensagem) e a confirmação no
 * canal aberto — o que o processor fazia logo depois do envio síncrono.
 *
 * `false` para row que não é do operador: os efeitos do widget seguem.
 */
export async function deliverOperatorReply(
  row: WidgetOutboxRecord,
  providerMessageId: string,
  deps: OperatorDeliveryDeps,
): Promise<boolean> {
  if (row.origin !== 'OPERATOR') return false
  const context = row.originContext
  if (!isOperatorOriginContext(context)) return true

  const media = row.kind === 'MEDIA' && row.mediaType ? row.mediaType : null
  try {
    await deps.persist({
      instanceId: row.instanceId,
      providerMessageId,
      bitrixMessageId: context.im.message_id,
      bitrixChatId: context.im.chat_id,
      chatId: context.connectorChatId,
      bitrixUserId: context.bitrixUserId,
      type: media
        ? PERSISTED_TYPE[media]
        : row.kind === 'INTERACTIVE_BUTTON'
          ? 'INTERACTIVE_BUTTON'
          : 'TEXT',
      text: media ? row.caption : row.text,
      fileName: media === 'document' ? row.fileName : null,
    })
  } catch (err) {
    logThinkzapError(apiLogger, 'thinkzap.message.outbound_persist_failed', {
      app: 'thinkzap',
      outboxId: row.id,
      providerMessageId,
      err,
    })
  }

  await deps.setDelivered(context, providerMessageId)
  return true
}

export type OperatorNoticeDeps = {
  /** Posta mensagem de sistema no chat do canal aberto. Nunca lança. */
  postNotice: (row: WidgetOutboxRecord, text: string) => Promise<boolean>
  /** Aviso de limite diário no chat, o mesmo do envio síncrono. */
  notifyDailyLimit: (row: WidgetOutboxRecord) => Promise<void>
  locale: (row: WidgetOutboxRecord) => Promise<NoticeLocale>
  /**
   * `SET NX` com prazo: `true` só para a primeira chamada com a mesma chave. É o
   * que faz várias respostas na mesma espera gerarem um aviso só.
   */
  claimOnce: (key: string, ttlMs: number) => Promise<boolean>
  now?: () => number
}

/**
 * O desfecho de uma resposta do operador que não saiu. Só o limite diário tem aviso
 * no chat (a capability `limite-diario-mensagens`); o resto fica no log do job.
 */
export async function notifyOperatorOutcome(
  outcome: WidgetSendOutcome,
  row: WidgetOutboxRecord,
  deps: Pick<OperatorNoticeDeps, 'notifyDailyLimit'>,
): Promise<void> {
  if (outcome === 'daily-limit') {
    await deps.notifyDailyLimit(row)
    return
  }
  apiLogger.warn(
    { app: 'thinkzap', outboxId: row.id, outcome },
    'Resposta do operador não entregue pela fila',
  )
}

/** Depois do `retryAt`, a chave do aviso já pode sumir. */
const NOTICE_KEY_GRACE_MS = 60 * 60 * 1000

/**
 * O aviso de espera ao operador: uma vez por espera (janela cheia ou pausa) e por
 * conversa. Falha ao postar só vai para o log — a mensagem continua na fila.
 */
export async function notifyOperatorWaiting(
  row: WidgetOutboxRecord,
  deferral: CadenceDeferral,
  lineKey: string,
  deps: OperatorNoticeDeps,
): Promise<void> {
  if (row.origin !== 'OPERATOR' || !row.bitrixChatId) return

  const now = deps.now ? deps.now() : Date.now()
  const key = `thinkzap:cadence-notice:${lineKey}:${row.bitrixChatId}:${deferral.waitKey}`
  const ttlMs = Math.max(deferral.retryAt - now, 0) + NOTICE_KEY_GRACE_MS
  if (!(await deps.claimOnce(key, ttlMs))) return

  const locale = await deps.locale(row).catch(() => DEFAULT_NOTICE_LOCALE)
  const posted = await deps
    .postNotice(row, cadenceNotices(locale).operatorWaiting(deferral.retryAt))
    .catch(() => false)

  if (!posted) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.cadence_notify_failed',
      {
        app: 'thinkzap',
        outboxId: row.id,
        bitrixChatId: row.bitrixChatId,
        retryAt: deferral.retryAt,
      },
      {
        msg: 'Aviso de espera da cadência não postado; a mensagem segue na fila',
      },
    )
  }
}
