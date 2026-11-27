import { notifySendFailures } from '@/modules/thinkzap/application/notify-send-failures'
import { refreshSendComment } from '@/modules/thinkzap/application/refresh-send-comment'
import {
  makeNotifySendFailuresDeps,
  makeRefreshSendCommentDeps,
} from '@/modules/thinkzap/main/make-send-notice-deps'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'

/**
 * Publica o comentário de status ou a notificação de falha de um aviso de envio.
 * Os casos de uso lançam no que vale tentar de novo, e o BullMQ retenta o job.
 */
export async function processSendNoticeJob(job: SendNoticeJob): Promise<void> {
  if (job.kind === 'comment') {
    await refreshSendComment(job.noticeId, makeRefreshSendCommentDeps())
    return
  }

  await notifySendFailures(job.noticeId, makeNotifySendFailuresDeps())
}
