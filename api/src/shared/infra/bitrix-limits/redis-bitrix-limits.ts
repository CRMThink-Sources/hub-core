import type IORedis from 'ioredis'
import { type Logger } from 'pino'
import { createLogger } from '@/shared/infra/logger'
import {
  type BitrixLimits,
  type BitrixLimitsContext,
} from './bitrix-limits.port'
import {
  type BucketLimits,
  DEFAULT_BUCKET_LIMITS,
  reserve,
} from './leaky-bucket'
import {
  OPERATING_WARN_RATIO,
  OPERATING_LIMIT_SECONDS,
} from './operating-budget'

/** Lazy pelo mesmo motivo do `attach-bitrix-limits`: import em suite com logger mockado. */
let cachedLog: Logger | undefined
const log = (): Logger =>
  (cachedLog ??= createLogger({
    service: 'hubthink-shared',
    source: 'bitrix-limits',
  }))

/**
 * Estado compartilhado entre workers e instâncias.
 *
 * Redis e não memória porque os dois limites do Bitrix são por portal e por app — e
 * nós rodamos vários processos contra o mesmo portal. Contador local deixaria cada
 * processo achar que tem o balde inteiro.
 */

/**
 * Reserva atômica no balde.
 *
 * Lua e não GET+SET: entre ler e gravar caberia outra chamada, e o balde
 * compartilhado perderia justamente as reservas concorrentes que ele existe para
 * ordenar. `TIME` do próprio Redis serve de relógio único — usar o relógio de cada
 * processo faria a vazão depender do desvio entre máquinas.
 */
const RESERVE_SCRIPT = `
local key = KEYS[1]
local drainPerSecond = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

local time = redis.call('TIME')
local nowMs = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)

local state = redis.call('HMGET', key, 'level', 'updatedAtMs')
local level = tonumber(state[1]) or 0
local updatedAtMs = tonumber(state[2]) or nowMs

local elapsed = math.max(0, nowMs - updatedAtMs) / 1000
level = math.max(0, level - (elapsed * drainPerSecond))

local after = level + cost
local waitMs = 0

if after > capacity then
  waitMs = math.ceil(((after - capacity) / drainPerSecond) * 1000)
  level = capacity
  updatedAtMs = nowMs + waitMs
else
  level = after
  updatedAtMs = nowMs
end

redis.call('HSET', key, 'level', level, 'updatedAtMs', updatedAtMs)
-- TTL cobre o tempo que o balde levaria para esvaziar sozinho: sem chamada nova,
-- o estado não tem valor e a chave não deve virar lixo permanente.
redis.call('PEXPIRE', key, math.ceil(((capacity / drainPerSecond) * 1000) + waitMs + 1000))

return waitMs
`

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

export type RedisBitrixLimitsOptions = {
  limits?: BucketLimits
  /**
   * Teto de espera numa reserva. Estourar significa portal saturado; aí é melhor
   * deixar a chamada ir e o erro aparecer do que segurar o worker indefinidamente.
   */
  maxWaitMs?: number
  operatingLimitSeconds?: number
}

export class RedisBitrixLimits implements BitrixLimits {
  private readonly limits: BucketLimits
  private readonly maxWaitMs: number
  private readonly operatingLimitSeconds: number

  constructor(
    private readonly redis: IORedis,
    options: RedisBitrixLimitsOptions = {},
  ) {
    this.limits = options.limits ?? DEFAULT_BUCKET_LIMITS
    this.maxWaitMs = options.maxWaitMs ?? 10_000
    this.operatingLimitSeconds =
      options.operatingLimitSeconds ?? OPERATING_LIMIT_SECONDS
  }

  /**
   * Falha de Redis **não** bloqueia chamada.
   *
   * O controle existe para evitar erro no Bitrix; transformar indisponibilidade dele
   * em indisponibilidade nossa trocaria um problema de degradação por um de parada.
   */
  async acquire(context: BitrixLimitsContext): Promise<void> {
    let waitMs = 0

    try {
      const result = await this.redis.eval(
        RESERVE_SCRIPT,
        1,
        this.bucketKey(context.domain),
        String(this.limits.drainPerSecond),
        String(this.limits.capacity),
        '1',
      )
      waitMs = Number(result) || 0
    } catch (err) {
      log().warn(
        { domain: context.domain, method: context.method, err },
        'Redis indisponível para o balde de request — seguindo sem controle',
      )
      return
    }

    if (waitMs <= 0) return

    const capped = Math.min(waitMs, this.maxWaitMs)
    log().info(
      {
        domain: context.domain,
        method: context.method,
        waitMs: capped,
        requestedWaitMs: waitMs,
        bitrixRateLimited: true,
      },
      'Balde de request cheio — atrasando a chamada',
    )
    await sleep(capped)
  }

  async pausedUntil(context: BitrixLimitsContext): Promise<number | null> {
    try {
      const raw = await this.redis.get(this.breakerKey(context))
      if (!raw) return null

      const untilMs = Number(raw)
      return Number.isFinite(untilMs) && untilMs > Date.now() ? untilMs : null
    } catch {
      return null
    }
  }

  /**
   * Pausa **antes** do 429 quando o método já queimou a maior parte do orçamento.
   *
   * `operating` é acumulado do método, não desta chamada: chegar perto do teto
   * significa que a próxima chamada é que leva o erro. Recuar aqui é o que impede o
   * bloqueio de cair sobre o app todo.
   */
  async observeOperating(
    context: BitrixLimitsContext,
    operatingSeconds: number,
    resetAtMs: number | null,
  ): Promise<void> {
    const ratio = operatingSeconds / this.operatingLimitSeconds
    if (ratio < OPERATING_WARN_RATIO) return

    const untilMs =
      resetAtMs && resetAtMs > Date.now() ? resetAtMs : Date.now() + 60_000

    log().warn(
      {
        domain: context.domain,
        method: context.method,
        operatingSeconds,
        ratio: Number(ratio.toFixed(2)),
        pausedUntil: new Date(untilMs).toISOString(),
        bitrixOperatingNearLimit: true,
      },
      'Orçamento de execução do método quase esgotado — pausando antes do 429',
    )

    await this.pauseMethod(context, untilMs)
  }

  async pauseMethod(
    context: BitrixLimitsContext,
    untilMs: number,
  ): Promise<void> {
    const ttlMs = Math.max(1_000, untilMs - Date.now())

    try {
      await this.redis.set(
        this.breakerKey(context),
        String(untilMs),
        'PX',
        Math.ceil(ttlMs),
      )
    } catch (err) {
      log().warn(
        { domain: context.domain, method: context.method, err },
        'Falha ao registrar pausa do método no Redis',
      )
    }
  }

  private bucketKey(domain: string): string {
    return `bitrix:bucket:${domain}`
  }

  /** Por portal **e** por método: o 429 do Bitrix é dessa granularidade. */
  private breakerKey(context: BitrixLimitsContext): string {
    return `bitrix:paused:${context.domain}:${context.method}`
  }
}
