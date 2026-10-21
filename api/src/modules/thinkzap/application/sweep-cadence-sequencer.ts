import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

/** Porta estreita da outbox: quais destes ids ainda esperam envio (PENDING/SENDING). */
export type LiveOutboxIds = {
  findLiveIds(ids: string[]): Promise<Set<string>>
}

/**
 * Tira da fila FIFO de cada linha os tickets cuja row da outbox não existe mais ou
 * já terminou. Sem isso, uma cabeça órfã — job morto sem passar pelo `finally` do
 * dispatcher — seguraria a linha inteira para sempre.
 *
 * **Duas rodadas seguidas** antes de remover: o ticket entra no Redis um instante
 * antes de a row existir (a sequência é gravada na row), e uma varredura no meio
 * desse instante não pode tirar a vez de quem está nascendo. A memória é do
 * processo; rodar em várias instâncias só repete um `ZREM` idempotente.
 */
export class SweepCadenceSequencer {
  private suspects = new Set<string>()

  constructor(
    private readonly cadence: SendCadence,
    private readonly outbox: LiveOutboxIds,
  ) {}

  async run(): Promise<{ removed: number }> {
    const nextSuspects = new Set<string>()
    let removed = 0

    for (const lineKey of await this.cadence.queuedLines()) {
      const tickets = await this.cadence.queuedTickets(lineKey)
      if (tickets.length === 0) continue

      const live = await this.outbox.findLiveIds(tickets)

      for (const outboxId of tickets) {
        if (live.has(outboxId)) continue

        const key = `${lineKey}:${outboxId}`
        if (!this.suspects.has(key)) {
          nextSuspects.add(key)
          continue
        }

        await this.cadence.dequeue(lineKey, outboxId)
        removed++
        logThinkzapError(
          apiLogger,
          'thinkzap.outbox.sequencer_stale_removed',
          { app: 'thinkzap', lineKey, outboxId },
          { msg: 'Ticket órfão removido da fila FIFO da linha' },
        )
      }
    }

    this.suspects = nextSuspects
    return { removed }
  }
}
