import type IORedis from 'ioredis'

/** Tempo para o `ONIMCONNECTORMESSAGEADD` da cópia chegar ao worker de saída. */
const RESERVATION_TTL_SECONDS = 5 * 60

/** Teto de uma postagem em andamento (`im.message.add` + gravar a reserva). */
const PENDING_TTL_SECONDS = 30

function reservationKey(domain: string, bitrixMessageId: string): string {
  return `thinkzap:mirror:v1:${domain}:msg:${bitrixMessageId}`
}

function pendingKey(domain: string, bitrixChatId: string): string {
  return `thinkzap:mirror:v1:${domain}:pending:${bitrixChatId}`
}

/**
 * Marca as mensagens que o espelhamento postou **como operador**, para o worker de
 * saída não reenviá-las ao WhatsApp.
 *
 * `im.message.add` como operador dispara `ONIMCONNECTORMESSAGEADD` igual a uma
 * resposta digitada. A chave é o id da mensagem no Bitrix (`im.message_id` no evento),
 * e não o texto: o evento entrega o texto transformado (nome do autor, `[br]`), que
 * não bate com o que foi postado.
 *
 * O id só existe depois que o `im.message.add` responde, e o evento pode chegar antes
 * de a reserva ser gravada. Por isso o chat fica marcado como **pendente** durante a
 * postagem: o worker que encontra o chat pendente espera a reserva aparecer antes de
 * decidir que é resposta de operador.
 *
 * O pendente é um contador, e não um booleano: duas mensagens do aparelho espelhadas
 * no mesmo chat ao mesmo tempo não podem apagar a marca uma da outra.
 */
export class MirroredMessageReservations {
  constructor(private readonly redis: IORedis) {}

  async markPending(domain: string, bitrixChatId: string): Promise<void> {
    const key = pendingKey(domain, bitrixChatId)
    await this.redis.multi().incr(key).expire(key, PENDING_TTL_SECONDS).exec()
  }

  async clearPending(domain: string, bitrixChatId: string): Promise<void> {
    const key = pendingKey(domain, bitrixChatId)
    const remaining = await this.redis.decr(key)
    if (remaining <= 0) await this.redis.del(key)
  }

  async isPending(domain: string, bitrixChatId: string): Promise<boolean> {
    const value = await this.redis.get(pendingKey(domain, bitrixChatId))
    return Number(value) > 0
  }

  /** `providerMessageId` é o id da Z-API, para o worker confirmar a entrega da cópia. */
  async register(
    domain: string,
    bitrixMessageId: string,
    providerMessageId: string,
  ): Promise<void> {
    await this.redis.set(
      reservationKey(domain, bitrixMessageId),
      providerMessageId,
      'EX',
      RESERVATION_TTL_SECONDS,
    )
  }

  /** Lê e apaga numa operação: o mesmo evento reentregue não é descartado duas vezes. */
  async consume(
    domain: string,
    bitrixMessageId: string,
  ): Promise<string | null> {
    // MULTI em vez de GETDEL: este exige Redis 6.2+.
    const key = reservationKey(domain, bitrixMessageId)
    const results = await this.redis.multi().get(key).del(key).exec()
    const value = results?.[0]?.[1]
    return typeof value === 'string' && value ? value : null
  }
}

export type MirroredMessageReservationReader = Pick<
  MirroredMessageReservations,
  'consume' | 'isPending'
>

/**
 * Se o evento de saída é a cópia de uma mensagem do aparelho: devolve o id da Z-API
 * da mensagem original, ou `null` quando é resposta de operador.
 *
 * Chat pendente sem reserva ainda = postagem no meio do caminho; espera até `waitMs`
 * pela reserva. Passado isso, trata como resposta de operador: uma resposta digitada
 * durante a janela só atrasa, nunca é descartada.
 */
export async function findMirroredDeviceMessage(
  reservations: MirroredMessageReservationReader,
  params: { domain: string; bitrixChatId: string; bitrixMessageId: string },
  options: {
    waitMs?: number
    intervalMs?: number
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<string | null> {
  const { domain, bitrixChatId, bitrixMessageId } = params
  const waitMs = options.waitMs ?? 5000
  const intervalMs = options.intervalMs ?? 250
  const sleep =
    options.sleep ?? (ms => new Promise<void>(r => setTimeout(r, ms)))

  const reserved = await reservations.consume(domain, bitrixMessageId)
  if (reserved) return reserved

  if (!(await reservations.isPending(domain, bitrixChatId))) return null

  for (let waited = 0; waited < waitMs; waited += intervalMs) {
    await sleep(intervalMs)
    const found = await reservations.consume(domain, bitrixMessageId)
    if (found) return found
    if (!(await reservations.isPending(domain, bitrixChatId))) {
      // A postagem terminou entre as leituras: última chance de a reserva estar lá.
      return reservations.consume(domain, bitrixMessageId)
    }
  }

  return null
}
