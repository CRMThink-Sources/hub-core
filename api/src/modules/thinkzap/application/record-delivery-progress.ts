import {
  isDeliveryFailureState,
  type HubMessageStateItem,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { isTrackedSend } from '@/modules/thinkzap/domain/send-notice'
import type { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { REJECTION_RETRY_DELAYS_MS } from './record-delivery-rejection'

const log = createWorkerSourceLogger('hubmessage')

export type ProgressKind = 'delivered' | 'read'

export type ProgressResult =
  | 'recorded'
  | 'duplicate'
  | 'untracked'
  | 'row-missing'
  | 'ignored'

/**
 * Esperas entre as tentativas de achar a row para Entregue e Lido. Mais curta que a da
 * recusa: a maioria destes eventos é de envio que nunca passou pelo outbox (resposta
 * do operador, bot), e cada tentativa a mais é um job inútil por mensagem. A entrega
 * chega segundos depois do aceite, quando o worker de envio já gravou o id.
 */
export const PROGRESS_RETRY_DELAYS_MS = [10_000, 60_000] as const

/**
 * `RECEIVED` -> delivered, `READ` -> read; qualquer outro estado -> null.
 *
 * Estado de recusa nunca é progresso, mesmo com nome de progresso: `isDeliveryFailureState`
 * também casa por `@class`, e o caso de uso, a escala de retentativas e o jobId precisam
 * concordar sobre qual ramo o evento segue.
 */
export function progressKindOf(
  stateItem: HubMessageStateItem | undefined,
): ProgressKind | null {
  if (isDeliveryFailureState(stateItem?.state)) return null
  switch (stateItem?.state?.name) {
    case 'RECEIVED':
      return 'delivered'
    case 'READ':
      return 'read'
    default:
      return null
  }
}

/**
 * A escala de retentativas do estado: o caso de uso decide se desiste e o processor
 * calcula a espera do job, e os dois precisam ler a mesma.
 */
export function retryDelaysFor(
  stateItem: HubMessageStateItem | undefined,
): readonly number[] {
  return progressKindOf(stateItem)
    ? PROGRESS_RETRY_DELAYS_MS
    : REJECTION_RETRY_DELAYS_MS
}

/** Antes disto o canal oficial nem existia para nós: valor assim é unidade errada. */
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2020, 0, 1)
/** Folga para relógio adiantado do provider. */
const MAX_FUTURE_SKEW_MS = 86_400_000

/**
 * `moment` do callback vem em segundos (amostras reais de RECEIVED e READ). Valor fora
 * da janela plausível (em milissegundos, por exemplo, cairia em outro milênio) vira
 * `null` e o chamador usa o relógio: um horário absurdo no comentário do CRM é pior
 * que alguns segundos de diferença.
 */
function momentOf(
  stateItem: HubMessageStateItem | undefined,
  now: Date,
): Date | null {
  const moment = stateItem?.moment
  if (typeof moment !== 'number' || !Number.isFinite(moment)) return null
  const ms = moment * 1000
  if (ms < EARLIEST_PLAUSIBLE_MS) return null
  if (ms > now.getTime() + MAX_FUTURE_SKEW_MS) return null
  return new Date(ms)
}

/**
 * Grava na row do outbox a entrega ou a leitura que a HubMessage informou, e agenda a
 * atualização do envio.
 *
 * O horário é o do evento, não o do processamento: o job pode ter esperado na fila, e
 * o comentário do CRM mostra quando o contato recebeu ou leu.
 *
 * Publica também na repetição (`duplicate`), como a recusa: se a primeira gravação
 * perdeu a publicação, a reentrega a recupera, e a publicação é idempotente.
 */
export async function recordDeliveryProgress(
  input: {
    instanceId: string
    providerMessageId: string
    stateItem: HubMessageStateItem | undefined
  },
  deps: {
    outbox: Pick<
      PrismaWidgetOutboxRepository,
      'findByProviderMessageId' | 'markDelivered' | 'markRead'
    >
    publish: (outboxId: string) => Promise<void>
    now: () => Date
  },
): Promise<ProgressResult> {
  const kind = progressKindOf(input.stateItem)
  if (!kind) return 'ignored'

  const row = await deps.outbox.findByProviderMessageId(
    input.instanceId,
    input.providerMessageId,
  )
  if (!row) return 'row-missing'
  if (!isTrackedSend(row)) return 'untracked'

  if (row.rejectedAt) {
    /**
     * Não deveria acontecer: a Meta recusou e depois diz que entregou. Grava mesmo
     * assim (o evento é o fato mais recente), mas deixa o caso filtrável para
     * entender a sequência se ele aparecer.
     */
    log.warn(
      {
        outboxId: row.id,
        providerMessageId: input.providerMessageId,
        progressKind: kind,
        deliveryAfterRejection: true,
      },
      'Entrega ou leitura recebida para envio já recusado',
    )
  }

  const now = deps.now()
  const at = momentOf(input.stateItem, now) ?? now
  const recorded =
    kind === 'read'
      ? await deps.outbox.markRead(row.id, at)
      : await deps.outbox.markDelivered(row.id, at)
  await deps.publish(row.id)
  return recorded ? 'recorded' : 'duplicate'
}
