import type {
  CadencePolicy,
  CadenceState,
} from '@/modules/thinkzap/domain/send-cadence'
import type { CadenceReserveOutcome } from '@/modules/thinkzap/domain/send-cadence-machine'

/** A vez de uma linha da outbox na fila FIFO da linha. */
export type CadenceTicket = {
  outboxId: string
  /** `queueSeq` gravado na linha da outbox ao enfileirar. */
  seq: number
}

/**
 * Cadência de envio e ordem FIFO por linha.
 *
 * `reserve` decide **num passo só** se o ticket é a cabeça da fila e se há vaga na
 * janela, e conta a vaga — o mesmo motivo da cota diária: "checar e depois contar"
 * deixa dois envios passarem na última vaga. Concedida a vaga, o ticket sai da
 * fila, e a cabeça seguinte já pode pedir a sua.
 */
export interface SendCadence {
  /** Dá ao envio a próxima posição da fila da linha e o põe nela. */
  enqueue(lineKey: string, outboxId: string): Promise<number>
  reserve(
    policy: CadencePolicy,
    ticket: CadenceTicket,
    now: Date,
  ): Promise<CadenceReserveOutcome>
  /** Devolve a vaga de um envio que o provider recusou. */
  release(lineKey: string, windowId: number): Promise<void>
  /** Tira o ticket da fila (desfecho terminal sem envio). Idempotente. */
  dequeue(lineKey: string, outboxId: string): Promise<void>
  /** Conta um envio feito fora da fila (espelhado); nunca nega. */
  registerExternal(policy: CadencePolicy, now: Date): Promise<void>
  state(lineKey: string, now: Date): Promise<CadenceState>
  /** Mensagens na fila da linha que ainda não receberam vaga. */
  waitingCount(lineKey: string): Promise<number>
  /** Para a varredura: linhas com fila e os ids nelas. */
  queuedLines(): Promise<string[]>
  queuedTickets(lineKey: string): Promise<string[]>
}
