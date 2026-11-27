import { DelayedError } from 'bullmq'
import type { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'
import { workerLogger } from '@/shared/infra/logger'

/**
 * Teto de adiamentos por job. A pausa por `OPERATION_TIME_LIMIT` dura até a cesta de
 * 10 min vencer e a recusa por intensidade adia 1 min: dez adiamentos cobrem uma pausa
 * real com folga. Um portal que segue recusando depois disso cai nas tentativas comuns
 * do job em vez de girar na fila para sempre.
 */
export const MAX_SEND_NOTICE_DEFERRALS = 10

export type DeferrableSendNoticeJob = {
  data: SendNoticeJob
  updateData(data: SendNoticeJob): Promise<void>
  moveToDelayed(timestamp: number, token?: string): Promise<void>
}

/**
 * Reagenda o job para o fim da pausa do Bitrix **sem gastar tentativa**, como o
 * worker de entrada faz: o `DelayedError` diz ao BullMQ que não houve falha. Sempre
 * lança — `DelayedError` ao adiar, o próprio erro no teto.
 *
 * Fora do worker para ser testável sem abrir conexão com o Redis.
 */
export async function deferSendNoticeJob(
  job: DeferrableSendNoticeJob,
  error: SendNoticeDeferredError,
  token: string | undefined,
  now: number = Date.now(),
): Promise<never> {
  const deferrals = job.data.deferrals ?? 0
  if (deferrals >= MAX_SEND_NOTICE_DEFERRALS) throw error

  const retryAt = Math.max(error.untilMs, now)
  workerLogger.warn(
    {
      app: 'thinkzap',
      kind: job.data.kind,
      noticeId: job.data.noticeId,
      deferrals: deferrals + 1,
      retryAt: new Date(retryAt).toISOString(),
      bitrixMethodPaused: true,
    },
    'Bitrix recusou por limite: aviso de envio reagendado sem gastar tentativa',
  )

  await job.updateData({ ...job.data, deferrals: deferrals + 1 })
  await job.moveToDelayed(retryAt, token)
  // Exigido pelo BullMQ para não tratar o job como concluído.
  throw new DelayedError()
}
