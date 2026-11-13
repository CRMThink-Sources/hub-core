import { prisma } from '@/config/prisma'
import type {
  DeliveryAttemptFailure,
  DeliveryAttemptRecorder,
  DeliveryAttemptRef,
} from '@/modules/thinkzap/domain/ports/delivery-attempt-recorder.port'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Teto da mensagem gravada. O erro de um provider pode trazer o corpo da resposta
 * inteiro; o suporte precisa do motivo, não do corpo, e a tabela é de curta duração.
 */
export const MAX_ATTEMPT_MESSAGE_LENGTH = 2000

export type DeliveryAttemptRecord = {
  id: string
  attempt: number
  errorCode: string
  message: string
  indeterminate: boolean
  durationMs: number | null
  createdAt: Date
}

/**
 * Log das tentativas que falharam, de envio e de recebimento (`ThinkzapDeliveryAttempt`).
 *
 * `recordFailure` **nunca lança**: é chamado no caminho do envio e do recebimento, e a
 * gravação do log não pode mudar o desfecho de nenhum dos dois.
 */
export class PrismaDeliveryAttemptRepository implements DeliveryAttemptRecorder {
  async recordFailure(
    ref: DeliveryAttemptRef,
    failure: DeliveryAttemptFailure,
  ): Promise<void> {
    try {
      /**
       * `max + 1`, e não o contador da outbox: o reprocessamento reaproveita a row e o
       * contador dela não é fonte confiável da numeração.
       */
      const last = await prisma.thinkzapDeliveryAttempt.aggregate({
        where: { refKind: ref.kind, refId: ref.id },
        _max: { attempt: true },
      })

      await prisma.thinkzapDeliveryAttempt.create({
        data: {
          refKind: ref.kind,
          refId: ref.id,
          attempt: (last._max.attempt ?? 0) + 1,
          errorCode: failure.errorCode,
          message: failure.message.slice(0, MAX_ATTEMPT_MESSAGE_LENGTH),
          indeterminate: failure.indeterminate ?? false,
          durationMs: failure.durationMs ?? null,
        },
      })
    } catch (err) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          refKind: ref.kind,
          refId: ref.id,
          err,
        },
        'Falha ao gravar o registro da tentativa; envio/recebimento segue',
      )
    }
  }

  /**
   * Expurgo por retenção: apaga até `limit` tentativas criadas antes de `cutoff` e devolve
   * quantas. O `deleteMany` do Prisma não aceita `LIMIT`, então os ids vêm antes — em
   * lote, para nenhuma operação segurar a tabela por muito tempo.
   */
  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    const rows = await prisma.thinkzapDeliveryAttempt.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    if (rows.length === 0) return 0

    const { count } = await prisma.thinkzapDeliveryAttempt.deleteMany({
      where: { id: { in: rows.map(row => row.id) } },
    })
    return count
  }

  /** Em ordem cronológica, que é como o detalhe da falha as mostra. */
  async listByRef(ref: DeliveryAttemptRef): Promise<DeliveryAttemptRecord[]> {
    const rows = await prisma.thinkzapDeliveryAttempt.findMany({
      where: { refKind: ref.kind, refId: ref.id },
      orderBy: [{ attempt: 'asc' }, { createdAt: 'asc' }],
    })

    return rows.map(row => ({
      id: row.id,
      attempt: row.attempt,
      errorCode: row.errorCode,
      message: row.message,
      indeterminate: row.indeterminate,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    }))
  }
}
