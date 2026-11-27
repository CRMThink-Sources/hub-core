import type { HubMessageStateItem } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { isTrackedSend } from '@/modules/thinkzap/domain/send-notice'
import type { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  buildFailureText,
  readMetaErrorCode,
} from './describe-hubmessage-delivery-failure'

/**
 * Esperas entre as tentativas de achar a row. A recusa pode chegar antes de o worker
 * de envio gravar o `providerMessageId`; o backoff da fila (segundos) não cobre um
 * envio lento, por isso a escala vai até cinco minutos.
 */
export const REJECTION_RETRY_DELAYS_MS = [
  10_000, 30_000, 60_000, 120_000, 300_000,
] as const

/** Teto da coluna `failureReason`. */
const MAX_REASON_LENGTH = 2000

export type RejectionResult =
  | 'recorded'
  | 'duplicate'
  | 'untracked'
  | 'row-missing'

/**
 * Grava na row do outbox a recusa que a Meta informou depois do aceite, e agenda o
 * aviso do envio.
 *
 * Só publica na primeira gravação: o provedor repete o webhook de status, e cada
 * repetição não pode virar um novo alerta a quem enviou.
 */
export async function recordDeliveryRejection(
  input: {
    instanceId: string
    providerMessageId: string
    stateItem: HubMessageStateItem | undefined
  },
  deps: {
    outbox: Pick<
      PrismaWidgetOutboxRepository,
      'findByProviderMessageId' | 'markRejected'
    >
    publish: (outboxId: string) => Promise<void>
    now: () => Date
  },
): Promise<RejectionResult> {
  const row = await deps.outbox.findByProviderMessageId(
    input.instanceId,
    input.providerMessageId,
  )
  if (!row) return 'row-missing'
  if (!isTrackedSend(row)) return 'untracked'

  const recorded = await deps.outbox.markRejected(row.id, {
    code: readMetaErrorCode(input.stateItem) ?? null,
    reason: buildFailureText(input.stateItem).slice(0, MAX_REASON_LENGTH),
    at: deps.now(),
  })
  if (!recorded) return 'duplicate'

  await deps.publish(row.id)
  return 'recorded'
}
