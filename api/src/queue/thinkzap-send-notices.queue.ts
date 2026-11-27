import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'

export const THINKZAP_SEND_NOTICES = 'thinkzap-send-notices'

/**
 * O que publicar sobre um aviso de envio: o comentário na timeline ou a
 * notificação de falha. Só o id viaja: o estado das partes é relido do banco na
 * hora de publicar.
 */
export type SendNoticeJob = {
  kind: 'comment' | 'alert'
  noticeId: string
  /** Quantas vezes o job já foi adiado por limite do Bitrix. Ausente = nenhuma. */
  deferrals?: number
}

/**
 * Quanto tempo cada publicação acumula eventos. O alerta espera mais para um
 * disparo com várias falhas virar uma notificação só.
 */
export const SEND_NOTICE_WINDOW_MS = {
  comment: 15_000,
  alert: 120_000,
} as const

/**
 * Folga depois do fim da janela: um relógio adiantado em quem agenda rodaria o job
 * com a janela ainda aberta, e um evento colapsado nele ficaria sem publicação.
 */
const WINDOW_GRACE_MS = 1_000

/** Falhos ficam 7 dias no Redis, o mesmo prazo das outras filas. */
const REMOVE_ON_FAIL = { age: 7 * 24 * 60 * 60 } as const

export const thinkzapSendNoticesQueue = new Queue<SendNoticeJob>(
  THINKZAP_SEND_NOTICES,
  bullBaseOptions,
)

/**
 * Um job por aviso e por janela fixa de tempo, rodando **depois do fim** dela: os eventos
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
    delay: (bucket + 1) * window + WINDOW_GRACE_MS - now,
  }
}

/** Com o Redis fora, o aviso pode se perder se o processo reiniciar antes de ele voltar. */
export async function enqueueSendNotice(job: SendNoticeJob): Promise<void> {
  await thinkzapSendNoticesQueue.add('process-send-notice', job, {
    ...sendNoticeSchedule(job, Date.now()),
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: REMOVE_ON_FAIL,
  })
}
