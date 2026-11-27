import { dailyLimitNotices } from '@/modules/thinkzap/domain/daily-limit-notices'
import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import { timelineLabels } from '@/modules/thinkzap/domain/notices/timeline-notices'
import type { SendPart } from '@/modules/thinkzap/domain/send-notice'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { describeHubMessageDeliveryFailure } from '../describe-hubmessage-delivery-failure'
import {
  DAILY_LIMIT_FAILURE,
  MEDIA_EXPIRED_FAILURE,
} from '../dispatch-widget-outbox-message'

/**
 * O que o comentário e a notificação de um disparo leem das rows. Compartilhado
 * para os dois explicarem a mesma falha com as mesmas palavras.
 */

/** Teto do erro cru no aviso: o `lastError` pode trazer um corpo HTTP inteiro. */
const RAW_ERROR_MAX_CHARS = 300

export function toSendPart(row: WidgetOutboxRecord): SendPart {
  return {
    destination: row.destination,
    status: row.status,
    rejectedAt: row.rejectedAt,
    lastError: row.lastError,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    // A row ainda não carrega a confirmação do provedor; a Task 2 liga os campos.
    deliveredAt: null,
    readAt: null,
  }
}

/** Motivo legível da parte que explica a falha, no idioma de `locale`. */
export function describeSendFailure(locale: NoticeLocale) {
  return (part: SendPart): string => {
    if (part.rejectedAt !== null) {
      return describeHubMessageDeliveryFailure(
        {
          external_information: {
            errors: [
              {
                code: part.failureCode ?? undefined,
                message: part.failureReason ?? undefined,
              },
            ],
          },
        },
        locale,
      )
    }
    if (part.lastError === DAILY_LIMIT_FAILURE) {
      return dailyLimitNotices(locale).chat
    }
    if (part.lastError === MEDIA_EXPIRED_FAILURE) {
      return timelineLabels(locale).file.reasons.unavailable
    }
    return (part.lastError ?? '').slice(0, RAW_ERROR_MAX_CHARS)
  }
}
