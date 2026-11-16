import type IORedis from 'ioredis'
import type {
  CadenceTicket,
  CadenceTurn,
  SendCadence,
} from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type {
  CadencePolicy,
  CadenceState,
} from '@/modules/thinkzap/domain/send-cadence'
import type {
  CadenceMachineState,
  CadenceReserveOutcome,
} from '@/modules/thinkzap/domain/send-cadence-machine'

/**
 * Quem não é a cabeça volta a tentar em ~meio segundo. O jitter espalha os jobs que
 * acordam juntos na abertura da janela.
 */
export const NOT_HEAD_RETRY_MS = 500

/** Folga do TTL do estado além do fim da janela/pausa. */
const STATE_TTL_PAD_MS = 60 * 60 * 1000

/**
 * A fila e a sequência não têm prazo — a espera não tem prazo. O TTL longo só
 * recolhe a chave de linha que parou de enviar; cada `enqueue` o renova.
 */
const QUEUE_TTL_SECONDS = 30 * 24 * 60 * 60

export function cadenceStateKey(lineKey: string): string {
  return `thinkzap:cadence:${lineKey}`
}

export function cadenceQueueKey(lineKey: string): string {
  return `thinkzap:cadence-queue:${lineKey}`
}

export function cadenceSeqKey(lineKey: string): string {
  return `thinkzap:cadence-seq:${lineKey}`
}

const QUEUE_KEY_PREFIX = 'thinkzap:cadence-queue:'

/**
 * Fila por destinatário. O prefixo **não** pode começar com `thinkzap:cadence-queue:`:
 * `queuedLines()` varre esse prefixo para achar as linhas com fila.
 */
export function cadenceDestPrefix(lineKey: string): string {
  return `thinkzap:cadence-dest:${lineKey}:`
}

export function cadenceDestKey(lineKey: string, destination: string): string {
  return `${cadenceDestPrefix(lineKey)}${destination}`
}

/** HASH outboxId → destino, para o `dequeue` achar a fila do destinatário sem a row. */
export function cadenceTicketDestKey(lineKey: string): string {
  return `thinkzap:cadence-ticketdest:${lineKey}`
}

/**
 * Leitura e escrita do hash, comuns aos scripts. Campos ausentes = 0.
 * Transcrição de `CadenceMachineState`.
 */
const LUA_STATE = `
local function load(key)
  local v = redis.call("hmget", key, "windowId", "windowEnd", "count", "pauseUntil", "snapN", "snapD", "snapP")
  return {
    windowId = tonumber(v[1] or "0"), windowEnd = tonumber(v[2] or "0"),
    count = tonumber(v[3] or "0"), pauseUntil = tonumber(v[4] or "0"),
    snapN = tonumber(v[5] or "0"), snapD = tonumber(v[6] or "0"), snapP = tonumber(v[7] or "0")
  }
end
local function save(key, s, now, pad)
  redis.call("hset", key,
    "windowId", s.windowId, "windowEnd", s.windowEnd, "count", s.count,
    "pauseUntil", s.pauseUntil, "snapN", s.snapN, "snapD", s.snapD, "snapP", s.snapP)
  local horizon = math.max(s.windowEnd, s.pauseUntil) - now
  if horizon < 0 then horizon = 0 end
  redis.call("pexpire", key, horizon + pad)
end
local function countInOpen(s, now)
  s.count = s.count + 1
  if s.count >= s.snapN and s.snapP > 0 then
    s.pauseUntil = now + s.snapP
    s.windowEnd = now
  end
  return s
end
local function openWindow(n, d, p, now)
  local s = { windowId = now, windowEnd = now + d, count = 0, pauseUntil = 0, snapN = n, snapD = d, snapP = p }
  return countInOpen(s, now)
end
`

/**
 * KEYS: state, queue, destQueue, ticketDest. ARGV: now, enabled ('1'|'0'), N, D(ms),
 * P(ms), ticketId, ticketSeq, notHeadRetryMs, ttlPadMs, destination, perDestination
 * ('1'|'0'), ttlSeconds.
 * Devolve `{1, windowId}` ou `{0, retryAt, reason}`. Espelha `reserveStep`.
 *
 * Modo relaxado (`ordersByDestination`): cadência desligada, sem pausa e sem janela
 * aberta (as duas últimas já saíram acima) e a chave de configuração ligada. Nele a
 * cabeça é a da fila do destinatário; fora dele, a da linha.
 */
export const RESERVE_SCRIPT = `${LUA_STATE}
local now = tonumber(ARGV[1])
local hasDest = ARGV[10] ~= ""
redis.call("zadd", KEYS[2], "NX", tonumber(ARGV[7]), ARGV[6])
if hasDest then
  redis.call("zadd", KEYS[3], "NX", tonumber(ARGV[7]), ARGV[6])
  redis.call("hset", KEYS[4], ARGV[6], ARGV[10])
  redis.call("expire", KEYS[3], tonumber(ARGV[12]))
  redis.call("expire", KEYS[4], tonumber(ARGV[12]))
end
local s = load(KEYS[1])
if s.pauseUntil > now then
  return {0, s.pauseUntil, "paused"}
end
if s.windowEnd > now and s.count >= s.snapN then
  return {0, s.windowEnd, "window-full"}
end
local relaxed = hasDest and ARGV[11] == "1" and ARGV[2] ~= "1" and s.windowEnd <= now
local headKey = KEYS[2]
if relaxed then headKey = KEYS[3] end
local head = redis.call("zrange", headKey, 0, 0)[1]
if head ~= ARGV[6] then
  return {0, now + tonumber(ARGV[8]), "not-head"}
end
redis.call("zrem", KEYS[2], ARGV[6])
if hasDest then
  redis.call("zrem", KEYS[3], ARGV[6])
  redis.call("hdel", KEYS[4], ARGV[6])
end
if s.windowEnd > now then
  s = countInOpen(s, now)
  save(KEYS[1], s, now, tonumber(ARGV[9]))
  return {1, s.windowId}
end
if ARGV[2] ~= "1" then
  redis.call("del", KEYS[1])
  return {1, 0}
end
s = openWindow(tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5]), now)
save(KEYS[1], s, now, tonumber(ARGV[9]))
return {1, s.windowId}
`

/** KEYS: state. ARGV: now, enabled, N, D, P, ttlPadMs. Espelha `registerExternalStep`. */
export const REGISTER_EXTERNAL_SCRIPT = `${LUA_STATE}
local now = tonumber(ARGV[1])
local s = load(KEYS[1])
if s.pauseUntil > now then return 0 end
if s.windowEnd > now and s.count >= s.snapN then return 0 end
if s.windowEnd > now then
  save(KEYS[1], countInOpen(s, now), now, tonumber(ARGV[6]))
  return 1
end
if ARGV[2] ~= "1" then return 0 end
save(KEYS[1], openWindow(tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5]), now), now, tonumber(ARGV[6]))
return 1
`

/** KEYS: state. ARGV: windowId. Espelha `releaseStep`. */
export const RELEASE_SCRIPT = `
local id = tonumber(redis.call("hget", KEYS[1], "windowId") or "0")
local count = tonumber(redis.call("hget", KEYS[1], "count") or "0")
if tonumber(ARGV[1]) == 0 or id ~= tonumber(ARGV[1]) or count <= 0 then return 0 end
return redis.call("hincrby", KEYS[1], "count", -1)
`

/**
 * KEYS: queue, ticketDest. ARGV: outboxId, perDestination ('1'|'0'), destPrefix.
 * Devolve 1 se o ticket está na fila e não é a cabeça da ordem do momento: a do
 * destinatário (`perDestination` e destino registrado) ou a da linha.
 * Só leitura: não insere o ticket nem o tira da fila.
 */
export const PEEK_TURN_SCRIPT = `
if not redis.call("zscore", KEYS[1], ARGV[1]) then return 0 end
if ARGV[2] == "1" then
  local dest = redis.call("hget", KEYS[2], ARGV[1])
  if dest then
    local destKey = ARGV[3] .. dest
    if redis.call("zscore", destKey, ARGV[1]) then
      if redis.call("zrange", destKey, 0, 0)[1] == ARGV[1] then return 0 end
      return 1
    end
  end
end
if redis.call("zrange", KEYS[1], 0, 0)[1] == ARGV[1] then return 0 end
return 1
`

/**
 * KEYS: seq, queue, destQueue, ticketDest. ARGV: outboxId, ttlSeconds, destination.
 * Devolve a sequência. O índice por destinatário é registrado sempre, com a chave de
 * configuração ligada ou não: assim ele já está populado quando ela for ligada.
 */
export const ENQUEUE_SCRIPT = `
local seq = redis.call("incr", KEYS[1])
redis.call("zadd", KEYS[2], "NX", seq, ARGV[1])
redis.call("expire", KEYS[1], ARGV[2])
redis.call("expire", KEYS[2], ARGV[2])
if ARGV[3] ~= "" then
  redis.call("zadd", KEYS[3], "NX", seq, ARGV[1])
  redis.call("hset", KEYS[4], ARGV[1], ARGV[3])
  redis.call("expire", KEYS[3], ARGV[2])
  redis.call("expire", KEYS[4], ARGV[2])
end
return seq
`

/**
 * KEYS: queue, ticketDest. ARGV: outboxId, destPrefix. Tira o ticket das três
 * estruturas, achando o destino pelo mapa (a varredura de órfãos não tem a row).
 */
export const DEQUEUE_SCRIPT = `
redis.call("zrem", KEYS[1], ARGV[1])
local dest = redis.call("hget", KEYS[2], ARGV[1])
if dest then
  redis.call("zrem", ARGV[2] .. dest, ARGV[1])
  redis.call("hdel", KEYS[2], ARGV[1])
end
return 1
`

const toInt = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function policyArgs(policy: CadencePolicy): string[] {
  return [
    policy.enabled ? '1' : '0',
    String(policy.maxMessages),
    String(policy.windowMs),
    String(policy.pauseMs),
  ]
}

export function toCadenceState(
  raw: Partial<Record<keyof CadenceMachineState, string>>,
  now: number,
): CadenceState {
  const s: CadenceMachineState = {
    windowId: toInt(raw.windowId),
    windowEnd: toInt(raw.windowEnd),
    count: toInt(raw.count),
    pauseUntil: toInt(raw.pauseUntil),
    snapN: toInt(raw.snapN),
    snapD: toInt(raw.snapD),
    snapP: toInt(raw.snapP),
  }
  const snapshot = {
    maxMessages: s.snapN,
    windowMs: s.snapD,
    pauseMs: s.snapP,
  }

  if (s.pauseUntil > now) {
    return {
      phase: 'paused',
      count: 0,
      max: null,
      windowEndsAt: null,
      pauseUntil: s.pauseUntil,
      snapshot,
    }
  }
  if (s.windowEnd > now) {
    return {
      phase: 'window',
      count: s.count,
      max: s.snapN,
      windowEndsAt: s.windowEnd,
      pauseUntil: null,
      snapshot,
    }
  }
  return {
    phase: 'idle',
    count: 0,
    max: null,
    windowEndsAt: null,
    pauseUntil: null,
    snapshot: null,
  }
}

export type RedisSendCadenceOptions = {
  /**
   * Com a cadência desativada, a ordem passa a ser por destinatário
   * (`THINKZAP_CADENCE_OFF_FIFO_PER_DESTINATION`). Só `reserve` e `peekTurn` leem;
   * o `enqueue` registra o índice sempre.
   */
  fifoPerDestination?: boolean
}

export class RedisSendCadence implements SendCadence {
  private readonly fifoPerDestination: boolean

  constructor(
    private readonly redis: IORedis,
    private readonly random: () => number = Math.random,
    options: RedisSendCadenceOptions = {},
  ) {
    this.fifoPerDestination = options.fifoPerDestination === true
  }

  async enqueue(
    lineKey: string,
    outboxId: string,
    destination: string,
  ): Promise<number> {
    return toInt(
      await this.redis.eval(
        ENQUEUE_SCRIPT,
        4,
        cadenceSeqKey(lineKey),
        cadenceQueueKey(lineKey),
        cadenceDestKey(lineKey, destination),
        cadenceTicketDestKey(lineKey),
        outboxId,
        String(QUEUE_TTL_SECONDS),
        destination,
      ),
    )
  }

  async peekTurn(
    lineKey: string,
    outboxId: string,
    now: Date,
    byDestination = false,
  ): Promise<CadenceTurn> {
    const behind = toInt(
      await this.redis.eval(
        PEEK_TURN_SCRIPT,
        2,
        cadenceQueueKey(lineKey),
        cadenceTicketDestKey(lineKey),
        outboxId,
        byDestination && this.fifoPerDestination ? '1' : '0',
        cadenceDestPrefix(lineKey),
      ),
    )
    if (behind !== 1) return { behind: false }
    return { behind: true, retryAt: now.getTime() + this.notHeadRetryMs() }
  }

  private notHeadRetryMs(): number {
    return Math.round(NOT_HEAD_RETRY_MS * (1 + this.random()))
  }

  async reserve(
    policy: CadencePolicy,
    ticket: CadenceTicket,
    now: Date,
  ): Promise<CadenceReserveOutcome> {
    const notHeadRetryMs = this.notHeadRetryMs()
    const result = (await this.redis.eval(
      RESERVE_SCRIPT,
      4,
      cadenceStateKey(policy.lineKey),
      cadenceQueueKey(policy.lineKey),
      cadenceDestKey(policy.lineKey, ticket.destination),
      cadenceTicketDestKey(policy.lineKey),
      String(now.getTime()),
      ...policyArgs(policy),
      ticket.outboxId,
      String(ticket.seq),
      String(notHeadRetryMs),
      String(STATE_TTL_PAD_MS),
      ticket.destination,
      this.fifoPerDestination ? '1' : '0',
      String(QUEUE_TTL_SECONDS),
    )) as [number, number, string?]

    if (toInt(result[0]) === 1) {
      return { allowed: true, windowId: toInt(result[1]) }
    }
    return {
      allowed: false,
      retryAt: toInt(result[1]),
      reason: (result[2] ?? 'not-head') as
        | 'paused'
        | 'window-full'
        | 'not-head',
    }
  }

  async release(lineKey: string, windowId: number): Promise<void> {
    if (windowId === 0) return
    await this.redis.eval(
      RELEASE_SCRIPT,
      1,
      cadenceStateKey(lineKey),
      String(windowId),
    )
  }

  async dequeue(lineKey: string, outboxId: string): Promise<void> {
    await this.redis.eval(
      DEQUEUE_SCRIPT,
      2,
      cadenceQueueKey(lineKey),
      cadenceTicketDestKey(lineKey),
      outboxId,
      cadenceDestPrefix(lineKey),
    )
  }

  async registerExternal(policy: CadencePolicy, now: Date): Promise<void> {
    await this.redis.eval(
      REGISTER_EXTERNAL_SCRIPT,
      1,
      cadenceStateKey(policy.lineKey),
      String(now.getTime()),
      ...policyArgs(policy),
      String(STATE_TTL_PAD_MS),
    )
  }

  async state(lineKey: string, now: Date): Promise<CadenceState> {
    const raw = await this.redis.hgetall(cadenceStateKey(lineKey))
    return toCadenceState(raw, now.getTime())
  }

  async waitingCount(lineKey: string): Promise<number> {
    return this.redis.zcard(cadenceQueueKey(lineKey))
  }

  async queuedLines(): Promise<string[]> {
    const lines: string[] = []
    let cursor = '0'
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${QUEUE_KEY_PREFIX}*`,
        'COUNT',
        200,
      )
      cursor = next
      for (const key of keys) lines.push(key.slice(QUEUE_KEY_PREFIX.length))
    } while (cursor !== '0')
    return lines
  }

  async queuedTickets(
    lineKey: string,
    limit?: number,
    offset = 0,
  ): Promise<string[]> {
    const start = Math.max(offset, 0)
    return this.redis.zrange(
      cadenceQueueKey(lineKey),
      start,
      limit === undefined ? -1 : start + Math.max(limit, 1) - 1,
    )
  }
}
