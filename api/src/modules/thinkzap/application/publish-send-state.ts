import { isTrackedSend } from '@/modules/thinkzap/domain/send-notice'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { PrismaSendNoticeRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'
import { apiLogger } from '@/shared/infra/logger'

/**
 * A conexão do BullMQ usa `maxRetriesPerRequest: null`: com o Redis inacessível, o
 * `add` não rejeita, fica na fila do cliente até a conexão voltar. Sem teto, o job
 * de envio que publica o estado ficaria pendurado junto. O comando continua
 * enfileirado na conexão; quem chamou é liberado.
 */
const ENQUEUE_TIMEOUT_MS = 5_000

export type PublishSendStateDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'findById' | 'linkSendNotice'>
  notices: Pick<PrismaSendNoticeRepository, 'ensure'>
  enqueue: (job: SendNoticeJob) => Promise<void>
}

async function withTimeout(work: Promise<unknown>): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('A fila de avisos não respondeu a tempo.')),
      ENQUEUE_TIMEOUT_MS,
    )
  })

  try {
    await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Relê a row, garante o aviso e agenda comentário e alerta. Nunca lança: o aviso é
 * acessório, e um erro aqui não pode fazer o job de envio ser retentado.
 */
export async function publishSendState(
  outboxId: string,
  deps: PublishSendStateDeps,
): Promise<void> {
  try {
    const row = await deps.outbox.findById(outboxId)
    if (!row || !isTrackedSend(row)) return

    let noticeId = row.sendNoticeId

    if (!noticeId) {
      const notice = await deps.notices.ensure({
        dispatchKey: row.dispatchGroupId ?? row.id,
        domainId: row.domainId,
        appCode: row.appCode,
        entity: row.entity,
        entityId: row.entityId,
        operatorBitrixUserId: row.operatorBitrixUserId,
      })
      noticeId = notice.id

      await deps.outbox.linkSendNotice(
        { rowId: row.id, dispatchGroupId: row.dispatchGroupId },
        noticeId,
      )
    }

    const jobs: SendNoticeJob[] = [{ kind: 'comment', noticeId }]

    if (
      row.status === 'FAILED' ||
      row.status === 'UNKNOWN' ||
      row.rejectedAt !== null
    ) {
      jobs.push({ kind: 'alert', noticeId })
    }

    // Os dois partem juntos: a falha de um não impede o outro, e o teto vale uma vez.
    await withTimeout(Promise.all(jobs.map(job => deps.enqueue(job))))
  } catch (err) {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', outboxId, err },
      { level: 'warn', msg: 'Não foi possível agendar o aviso de envio' },
    )
  }
}
