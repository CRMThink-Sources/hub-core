import type IORedis from 'ioredis'
import { dayKeyOf } from '@/modules/thinkzap/domain/connector-trial'
import type { DailyLimitPolicy } from '@/modules/thinkzap/domain/daily-send-limit'
import type {
  DailyQuotaReserveResult,
  DailySendCounts,
  DailySendQuota,
} from '@/modules/thinkzap/domain/ports/daily-send-quota.port'

/**
 * Dois dias: a chave carrega a data, então a virada é automática e o TTL só
 * recolhe o lixo. Folga sobre 24h para que o dia corrente nunca expire antes de
 * acabar, qualquer que seja a hora do primeiro envio.
 */
const TTL_SECONDS = 48 * 60 * 60

export function dailySentKey(lineKey: string, day: string): string {
  return `thinkzap:daily-sent:${lineKey}:${day}`
}

export function dailyExtraKey(lineKey: string, day: string): string {
  return `thinkzap:daily-extra:${lineKey}:${day}`
}

/**
 * KEYS: sent, extra. ARGV: enabled ('1'|'0'), limit, ttl.
 * Devolve `{ reservado (1|0), sent, extra }` — `sent` já somado quando reservou.
 */
export const RESERVE_SCRIPT = `
local sent = tonumber(redis.call("get", KEYS[1]) or "0")
local extra = tonumber(redis.call("get", KEYS[2]) or "0")
if ARGV[1] == "1" and sent >= tonumber(ARGV[2]) + extra then
  return {0, sent, extra}
end
local n = redis.call("incr", KEYS[1])
redis.call("expire", KEYS[1], ARGV[3])
return {1, n, extra}
`

/** KEYS: sent. Não desce de zero: chave expirada ou reiniciada não vira negativa. */
export const RELEASE_SCRIPT = `
local v = tonumber(redis.call("get", KEYS[1]) or "0")
if v > 0 then
  return redis.call("decr", KEYS[1])
end
return 0
`

/** KEYS: extra. ARGV: amount, ttl. */
export const ADD_EXTRA_SCRIPT = `
local n = redis.call("incrby", KEYS[1], ARGV[1])
redis.call("expire", KEYS[1], ARGV[2])
return n
`

const toInt = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export class RedisDailySendQuota implements DailySendQuota {
  constructor(private readonly redis: IORedis) {}

  async reserve(
    policy: DailyLimitPolicy,
    now: Date,
  ): Promise<DailyQuotaReserveResult> {
    const day = dayKeyOf(now)
    const sentKey = dailySentKey(policy.lineKey, day)

    const [reserved, sent, extra] = (await this.redis.eval(
      RESERVE_SCRIPT,
      2,
      sentKey,
      dailyExtraKey(policy.lineKey, day),
      policy.enabled ? '1' : '0',
      String(policy.limit),
      String(TTL_SECONDS),
    )) as [number, number, number]

    if (toInt(reserved) !== 1) {
      return {
        status: 'refused',
        counts: { sent: toInt(sent), extra: toInt(extra) },
        effectiveLimit: policy.limit + toInt(extra),
      }
    }

    let released = false
    return {
      status: 'reserved',
      reservation: {
        release: async () => {
          if (released) return
          released = true
          await this.redis.eval(RELEASE_SCRIPT, 1, sentKey)
        },
      },
    }
  }

  async wouldRefuse(policy: DailyLimitPolicy, now: Date): Promise<boolean> {
    if (!policy.enabled) return false

    const { sent, extra } = await this.usage(policy.lineKey, now)
    return sent >= policy.limit + extra
  }

  async addExtra(
    lineKey: string,
    amount: number,
    now: Date,
  ): Promise<DailySendCounts> {
    const day = dayKeyOf(now)

    await this.redis.eval(
      ADD_EXTRA_SCRIPT,
      1,
      dailyExtraKey(lineKey, day),
      String(amount),
      String(TTL_SECONDS),
    )

    return this.usage(lineKey, now)
  }

  async usage(lineKey: string, now: Date): Promise<DailySendCounts> {
    const day = dayKeyOf(now)
    const [sent, extra] = await this.redis.mget(
      dailySentKey(lineKey, day),
      dailyExtraKey(lineKey, day),
    )

    return { sent: toInt(sent), extra: toInt(extra) }
  }
}
