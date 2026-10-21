import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import { apiLogger } from '@/shared/infra/logger'

export type SequenceOutboxRowsDeps = {
  cadence: SendCadence | null
  outbox: { setQueueSeq(id: string, queueSeq: number): Promise<void> }
}

/**
 * Põe as rows recém-gravadas na fila FIFO da linha, **na ordem em que chegaram**, e
 * grava a posição em cada uma.
 *
 * É aqui, no enfileiramento, e não no despacho, porque o despacho roda com
 * concorrência: a ordem de processamento dos jobs não é a ordem de chegada.
 *
 * Só linha Z-API (a oficial não tem cadência). Falha do Redis **não recusa o
 * envio**: a row já está durável, e o despacho dá a vez à row sem posição na
 * primeira tentativa — perde-se só a ordem exata daquela mensagem.
 */
export async function sequenceOutboxRows(
  deps: SequenceOutboxRowsDeps,
  item: SubscriptionItem,
  rows: { id: string; queueSeq?: number | null }[],
): Promise<void> {
  if (!deps.cadence) return
  if (item.metadata.provider !== 'ZAPI') return

  const lineKey = item.metadata.zApiInstanceId

  for (const row of rows) {
    if (row.queueSeq != null) continue
    try {
      const seq = await deps.cadence.enqueue(lineKey, row.id)
      await deps.outbox.setQueueSeq(row.id, seq)
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', lineKey, outboxId: row.id, err },
        'Row não entrou na fila FIFO da linha; o despacho dá a vez a ela',
      )
    }
  }
}
