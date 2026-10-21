import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { WidgetSendScheduler } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

/** Porta estreita da outbox: quais destes ids ainda esperam envio (PENDING/SENDING). */
export type LiveOutboxIds = {
  findLiveIds(ids: string[]): Promise<Set<string>>
}

export type SweepResult = {
  /** Tickets órfãos tirados da fila. */
  removed: number
  /** Cabeças vivas que estavam sem job e tiveram o job recriado. */
  rescheduled: number
}

/**
 * Mantém a fila FIFO de cada linha andando. Duas coisas por linha:
 *
 * 1. **Ticket órfão** — a row da outbox não existe mais ou já terminou (job morto sem
 *    passar pelo `finally` do dispatcher): sai da fila. Senão seguraria a linha.
 * 2. **Cabeça viva sem job** — a row está PENDING/SENDING mas nenhum job dela vai
 *    rodar (esgotou as tentativas por um erro antes do envio, ou o enfileiramento
 *    falhou depois de a row entrar na fila). Ninguém acordaria essa mensagem, e a
 *    linha inteira esperaria atrás dela: o job é recriado. Só a cabeça — as demais
 *    viram cabeça depois e passam pela mesma checagem.
 *
 * **Duas rodadas seguidas** antes de agir, nos dois casos: o ticket entra no Redis um
 * instante antes do job (e da row, no caso do ticket do despacho), e uma varredura
 * no meio desse instante não pode atropelar quem está nascendo. A memória é do
 * processo; rodar em várias instâncias só repete operações idempotentes.
 */
export class SweepCadenceSequencer {
  private suspects = new Set<string>()
  private headSuspects = new Set<string>()

  constructor(
    private readonly cadence: SendCadence,
    private readonly outbox: LiveOutboxIds,
    /** Ausente, só a limpeza de órfãos roda. */
    private readonly scheduler: WidgetSendScheduler | null = null,
  ) {}

  async run(): Promise<SweepResult> {
    const nextSuspects = new Set<string>()
    const nextHeadSuspects = new Set<string>()
    const result: SweepResult = { removed: 0, rescheduled: 0 }

    for (const lineKey of await this.cadence.queuedLines()) {
      try {
        await this.sweepLine(lineKey, nextSuspects, nextHeadSuspects, result)
      } catch (err) {
        // Uma linha com problema não pode parar a varredura das outras.
        apiLogger.warn(
          { app: 'thinkzap', lineKey, err },
          'Varredura da fila FIFO falhou para a linha',
        )
      }
    }

    this.suspects = nextSuspects
    this.headSuspects = nextHeadSuspects
    return result
  }

  private async sweepLine(
    lineKey: string,
    nextSuspects: Set<string>,
    nextHeadSuspects: Set<string>,
    result: SweepResult,
  ): Promise<void> {
    const tickets = await this.cadence.queuedTickets(lineKey)
    if (tickets.length === 0) return

    const live = await this.outbox.findLiveIds(tickets)

    for (const outboxId of tickets) {
      if (live.has(outboxId)) continue

      const key = `${lineKey}:${outboxId}`
      if (!this.suspects.has(key)) {
        nextSuspects.add(key)
        continue
      }

      await this.cadence.dequeue(lineKey, outboxId)
      result.removed++
      logThinkzapError(
        apiLogger,
        'thinkzap.outbox.sequencer_stale_removed',
        { app: 'thinkzap', lineKey, outboxId },
        { msg: 'Ticket órfão removido da fila FIFO da linha' },
      )
    }

    if (!this.scheduler) return

    const head = tickets.find(id => live.has(id))
    if (!head) return

    const key = `${lineKey}:${head}`
    nextHeadSuspects.add(key)
    if (!this.headSuspects.has(key)) return

    if (await this.scheduler.ensureScheduled(head)) {
      result.rescheduled++
      logThinkzapError(
        apiLogger,
        'thinkzap.outbox.sequencer_head_rescheduled',
        { app: 'thinkzap', lineKey, outboxId: head },
        {
          msg: 'Primeira da fila da linha estava sem job agendado; job recriado',
        },
      )
    }
  }
}
