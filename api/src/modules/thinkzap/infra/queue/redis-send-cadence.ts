import type IORedis from 'ioredis'
import type {
  CadenceTicket,
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
 * KEYS: state, queue. ARGV: now, enabled ('1'|'0'), N, D(ms), P(ms), ticketId,
 * ticketSeq, notHeadRetryMs, ttlPadMs.
 * Devolve `{1, windowId}` ou `{0, retryAt, reason}`. Espelha `reserveStep`.
 */
export const RESERVE_SCRIPT = `${LUA_STATE}
local now = tonumber(ARGV[1])
redis.call("zadd", KEYS[2], "NX", tonumber(ARGV[7]), ARGV[6])
local s = load(KEYS[1])
if s.pauseUntil > now then
  return {0, s.pauseUntil, "paused"}
end
if s.windowEnd > now and s.count >= s.snapN then
  return {0, s.windowEnd, "window-full"}
end
local head = redis.call("zrange", KEYS[2], 0, 0)[1]
if head ~= ARGV[6] then
  return {0, now + tonumber(ARGV[8]), "not-head"}
end
redis.call("zrem", KEYS[2], ARGV[6])
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

/** KEYS: seq, queue. ARGV: outboxId, ttlSeconds. Devolve a sequência. */
export const ENQUEUE_SCRIPT = `
local seq = redis.call("incr", KEYS[1])
redis.call("zadd", KEYS[2], "NX", seq, ARGV[1])
redis.call("expire", KEYS[1], ARGV[2])
redis.call("expire", KEYS[2], ARGV[2])
return seq
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

export class RedisSendCadence implements SendCadence {
  constructor(
    private readonly redis: IORedis,
    private readonly random: () => number = Math.random,
  ) {}

  async enqueue(lineKey: string, outboxId: string): Promise<number> {
    return toInt(
      await this.redis.eval(
        ENQUEUE_SCRIPT,
        2,
        cadenceSeqKey(lineKey),
        cadenceQueueKey(lineKey),
        outboxId,
        String(QUEUE_TTL_SECONDS),
      ),
    )
  }

  async reserve(
    policy: CadencePolicy,
    ticket: CadenceTicket,
    now: Date,
  ): Promise<CadenceReserveOutcome> {
    const notHeadRetryMs = Math.round(NOT_HEAD_RETRY_MS * (1 + this.random()))
    const result = (await this.redis.eval(
      RESERVE_SCRIPT,
      2,
      cadenceStateKey(policy.lineKey),
      cadenceQueueKey(policy.lineKey),
      String(now.getTime()),
      ...policyArgs(policy),
      ticket.outboxId,
      String(ticket.seq),
      String(notHeadRetryMs),
      String(STATE_TTL_PAD_MS),
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
    await this.redis.zrem(cadenceQueueKey(lineKey), outboxId)
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

  async queuedTickets(lineKey: string, limit?: number): Promise<string[]> {
    return this.redis.zrange(
      cadenceQueueKey(lineKey),
      0,
      limit === undefined ? -1 : Math.max(limit - 1, 0),
    )
  }
}
