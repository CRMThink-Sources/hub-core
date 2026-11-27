import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import { renderSendAlert } from '@/modules/thinkzap/domain/notices/send-comment'
import {
  failureCount,
  summarizeRecipients,
  type RecipientSummary,
  type SendPart,
} from '@/modules/thinkzap/domain/send-notice'
import type {
  PrismaSendNoticeRepository,
  SendNoticeRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BitrixSystemNotificationService } from '@/shared/application/bitrix-system-notification.service'
import { bitrixRefusedUntil } from '@/shared/infra/bitrix-limits/limit-errors'
import type {
  BitrixClient,
  ICrmItemResponse,
} from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { crmRecordReference } from './helpers/crm-record-reference'
import { describeSendFailure, toSendPart } from './helpers/send-failure'

export type NotifySendFailuresDeps = {
  notices: Pick<PrismaSendNoticeRepository, 'findById' | 'saveAlerted'>
  outbox: Pick<PrismaWidgetOutboxRepository, 'findBySendNotice'>
  /** `null` = sem como falar com o Bitrix do portal (domínio removido). */
  bitrix: (
    notice: SendNoticeRecord,
  ) => Promise<Pick<BitrixClient, 'callMethod'> | null>
  locale: (notice: SendNoticeRecord) => Promise<NoticeLocale>
  now: () => Date
}

/**
 * Lançado para o job tentar de novo: a notificação do Bitrix é best-effort e só
 * devolve `false`, e sem erro o job daria o aviso por entregue.
 */
export class SendFailureAlertError extends Error {
  constructor(noticeId: string) {
    super(
      `A notificação de falha do aviso de envio ${noticeId} não foi aceita pelo Bitrix; confira o escopo "im" do app. O job tenta de novo.`,
    )
    this.name = 'SendFailureAlertError'
  }
}

/** O motivo comum a todas as falhas; `null` se divergem ou não há o que dizer. */
function sharedReason(
  failed: RecipientSummary[],
  describe: (part: SendPart) => string,
): string | null {
  const reasons = new Set(
    failed.map(({ failedPart }) => (failedPart ? describe(failedPart) : '')),
  )
  const [only] = reasons

  return reasons.size === 1 && only ? only : null
}

/** Id de usuário do Bitrix, ou `null` quando o valor não aponta para ninguém. */
function toUserId(value: unknown): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Quem disparou; sem operador (automação), o responsável pelo registro. */
async function resolveRecipient(
  notice: SendNoticeRecord,
  record: ReturnType<typeof crmRecordReference>,
  bitrix: Pick<BitrixClient, 'callMethod'>,
): Promise<number | null> {
  const operator = toUserId(notice.operatorBitrixUserId)
  if (operator || !record) return operator

  const response = await bitrix.callMethod<ICrmItemResponse>('crm.item.get', {
    entityTypeId: record.entityTypeId,
    id: notice.entityId,
  })
  return toUserId(response.result?.item?.assignedById)
}

/**
 * Notifica quem enviou sobre as falhas e recusas de um disparo. Só quando a
 * contagem passa da já avisada: a mesma recusa reprocessada não repete a
 * notificação. A tag por aviso faz a nova substituir a anterior no Bitrix.
 *
 * Bitrix pausado ou recusando por limite vira `SendNoticeDeferredError`: o worker
 * reagenda o alerta para depois da pausa, em vez de gastar as tentativas nela.
 */
export async function notifySendFailures(
  noticeId: string,
  deps: NotifySendFailuresDeps,
): Promise<void> {
  try {
    await notify(noticeId, deps)
  } catch (error) {
    const untilMs = bitrixRefusedUntil(error, deps.now().getTime())
    if (untilMs === null) throw error
    throw new SendNoticeDeferredError(noticeId, untilMs, error)
  }
}

async function notify(
  noticeId: string,
  deps: NotifySendFailuresDeps,
): Promise<void> {
  const notice = await deps.notices.findById(noticeId)
  if (!notice) return

  const rows = await deps.outbox.findBySendNotice(noticeId)
  const recipients = summarizeRecipients(rows.map(toSendPart))
  const failures = failureCount(recipients)
  if (failures <= notice.alertedFailures) return

  const bitrix = await deps.bitrix(notice)
  if (!bitrix) {
    apiLogger.warn(
      { app: 'thinkzap', noticeId },
      'Aviso de envio sem cliente Bitrix: falha não notificada',
    )
    return
  }

  const record = crmRecordReference(notice.entity, notice.entityId)
  const userId = await resolveRecipient(notice, record, bitrix)
  if (!userId) {
    apiLogger.warn(
      { app: 'thinkzap', noticeId },
      'Aviso de envio sem operador nem responsável: falha não notificada',
    )
    return
  }

  const locale = await deps.locale(notice)
  const failed = recipients.filter(
    ({ state }) => state === 'FAILED' || state === 'PARTIAL',
  )
  const message = renderSendAlert({
    locale,
    failed: failed.length,
    // Inclui quem também falhou: o "confira antes de reenviar" não pode sumir.
    unknown: recipients.filter(({ hasUnconfirmed }) => hasUnconfirmed).length,
    reason: sharedReason(failed, describeSendFailure(locale)),
    recordUrl: record?.url ?? null,
  })

  const notified = await new BitrixSystemNotificationService(
    bitrix,
  ).notifyOrDefer({
    userId,
    message,
    tag: `thinkzap-send-${noticeId}`,
  })
  if (!notified) throw new SendFailureAlertError(noticeId)

  await deps.notices.saveAlerted(noticeId, failures)
}
