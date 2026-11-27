import { notifySendFailures } from '@/modules/thinkzap/application/notify-send-failures'
import { refreshSendComment } from '@/modules/thinkzap/application/refresh-send-comment'
import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import {
  makeNotifySendFailuresDeps,
  makeRefreshSendCommentDeps,
} from '@/modules/thinkzap/main/make-send-notice-deps'
import {
  deferSendNoticeJob,
  type DeferrableSendNoticeJob,
} from './send-notice-deferral'

/**
 * Publica o comentário de status ou a notificação de falha de um aviso de envio.
 * Os casos de uso lançam no que vale tentar de novo, e o BullMQ retenta o job; a
 * recusa por limite do Bitrix reagenda sem gastar tentativa.
 */
export async function processSendNoticeJob(
  job: DeferrableSendNoticeJob,
  token?: string,
): Promise<void> {
  const { kind, noticeId } = job.data
  try {
    if (kind === 'comment') {
      await refreshSendComment(noticeId, makeRefreshSendCommentDeps())
      return
    }

    await notifySendFailures(noticeId, makeNotifySendFailuresDeps())
  } catch (error) {
    if (error instanceof SendNoticeDeferredError) {
      await deferSendNoticeJob(job, error, token)
    }
    throw error
  }
}
