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
  /**
   * Destinatário da mensagem (`row.destination`). Com a cadência desativada, é a
   * ordem entre mensagens do mesmo destinatário que importa. Vazio = sem destino:
   * o ticket só segue a ordem da linha.
   */
  destination: string
}

/** `retryAt` (epoch ms) é quando quem está atrás volta a olhar a fila. */
export type CadenceTurn = { behind: true; retryAt: number } | { behind: false }

/**
 * Cadência de envio e ordem FIFO por linha.
 *
 * `reserve` decide **num passo só** se o ticket é a cabeça da fila e se há vaga na
 * janela, e conta a vaga — o mesmo motivo da cota diária: "checar e depois contar"
 * deixa dois envios passarem na última vaga. Concedida a vaga, o ticket sai da
 * fila, e a cabeça seguinte já pode pedir a sua.
 */
export interface SendCadence {
  /**
   * Dá ao envio a próxima posição da fila da linha e o põe nela, registrando também o
   * destinatário (índice para a ordem por destinatário, usada sem cadência).
   */
  enqueue(
    lineKey: string,
    outboxId: string,
    destination: string,
  ): Promise<number>
  reserve(
    policy: CadencePolicy,
    ticket: CadenceTicket,
    now: Date,
  ): Promise<CadenceReserveOutcome>
  /**
   * Só leitura: o ticket está na fila e **outro** é a cabeça. Serve para desistir
   * cedo, sem pagar o despacho inteiro — quem decide a vez continua sendo `reserve`.
   * Ticket fora da fila não está atrás de ninguém: o despacho completo decide.
   *
   * `byDestination` = a linha estava sem cadência na última resolução: compara com
   * a cabeça do destinatário, não com a da linha. Só desiste cedo; o `reserve`
   * continua decidindo, então um valor desatualizado custa uma tentativa a mais.
   */
  peekTurn(
    lineKey: string,
    outboxId: string,
    now: Date,
    byDestination?: boolean,
  ): Promise<CadenceTurn>
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
  /**
   * Em ordem de saída. Sem `limit`, todos; com ele, `limit` tickets a partir da
   * posição `offset` (0 = a cabeça).
   */
  queuedTickets(
    lineKey: string,
    limit?: number,
    offset?: number,
  ): Promise<string[]>
}
