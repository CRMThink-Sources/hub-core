import { DelayedError } from 'bullmq'
import type { WidgetSendJobOutcome } from './thinkzap-widget-send.processor'

// Curto (espera típica = um envio), mas sem virar espera ativa contra o Redis.
export const DESTINATION_BUSY_RETRY_MS = 2_000

type DelayableJob = {
  moveToDelayed(timestamp: number, token?: string): Promise<void>
}

/**
 * Aplica o desfecho do despacho ao job. Adiar **não gasta tentativa**: o job volta
 * para a fila atrasada e o `DelayedError` diz ao BullMQ que não houve falha —
 * erro comum esgotaria as tentativas só por contenção ou por espera de cadência.
 *
 * Fora do worker para ser testável sem abrir conexão com o Redis.
 */
export async function applyWidgetSendOutcome(
  job: DelayableJob,
  outcome: WidgetSendJobOutcome,
  token: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  if (outcome === 'done') return

  if (outcome === 'reschedule') {
    await job.moveToDelayed(now + DESTINATION_BUSY_RETRY_MS, token)
    throw new DelayedError()
  }

  // Cadência: espera a janela/pausa (ou a vez na fila) sem prazo.
  await job.moveToDelayed(Math.max(outcome.deferUntil, now), token)
  throw new DelayedError()
}
