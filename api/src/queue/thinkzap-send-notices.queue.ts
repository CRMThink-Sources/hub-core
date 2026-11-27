import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'

export const THINKZAP_SEND_NOTICES = 'thinkzap-send-notices'

/**
 * O que publicar sobre um aviso de envio: o comentário na timeline ou a
 * notificação de falha. Só o id viaja: o estado das partes é relido do banco na
 * hora de publicar.
 */
export type SendNoticeJob = { kind: 'comment' | 'alert'; noticeId: string }

/**
 * Quanto tempo cada publicação acumula eventos. O alerta espera mais para um
 * disparo com várias falhas virar uma notificação só.
 */
export const SEND_NOTICE_WINDOW_MS = {
  comment: 15_000,
  alert: 120_000,
} as const

export const thinkzapSendNoticesQueue = new Queue<SendNoticeJob>(
  THINKZAP_SEND_NOTICES,
  bullBaseOptions,
)

/**
 * Um job por aviso e por janela fixa de tempo, rodando no **fim** dela: os eventos
 * da mesma janela colapsam no mesmo `jobId`, e o que chega durante a execução já
 * pertence à janela seguinte, então não se perde num job que já leu o banco.
 *
 * Separador `-` porque o BullMQ rejeita `:` em `jobId` customizado.
 */
export function sendNoticeSchedule(
  job: SendNoticeJob,
  now: number,
): { jobId: string; delay: number } {
  const window = SEND_NOTICE_WINDOW_MS[job.kind]
  const bucket = Math.floor(now / window)

  return {
    jobId: `send-notice-${job.kind}-${job.noticeId}-${bucket}`,
    delay: (bucket + 1) * window - now,
  }
}

export async function enqueueSendNotice(job: SendNoticeJob): Promise<void> {
  await thinkzapSendNoticesQueue.add('process-send-notice', job, {
    ...sendNoticeSchedule(job, Date.now()),
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: true,
  })
}
