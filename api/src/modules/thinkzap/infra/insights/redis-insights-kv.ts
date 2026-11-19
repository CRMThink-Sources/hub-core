import type IORedis from 'ioredis'
import type { InsightsKv } from '@/modules/thinkzap/domain/ports/insights-kv.port'

type RedisLike = Pick<IORedis, 'get' | 'set' | 'del' | 'incr' | 'scan'>

// Lote do SCAN: pequeno o bastante para não segurar o Redis, grande o bastante
// para não virar centenas de idas e voltas.
const SCAN_COUNT = 200

// A conexão compartilhada com o BullMQ usa `maxRetriesPerRequest: null`: com o
// Redis inacessível, um comando fica na fila para sempre. Sem teto aqui, toda
// abertura do Insights penduraria até o timeout do proxy. O comando continua
// enfileirado na conexão; quem chamou é liberado com erro.
const DEFAULT_TIMEOUT_MS = 10_000

export class InsightsKvTimeoutError extends Error {
  constructor() {
    super('O Redis do Insights não respondeu a tempo.')
    this.name = 'InsightsKvTimeoutError'
  }
}

/** `InsightsKv` sobre o Redis da API (o mesmo do BullMQ). */
export class RedisInsightsKv implements InsightsKv {
  constructor(
    private readonly redis: RedisLike,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new InsightsKvTimeoutError()),
        this.timeoutMs,
      )
    })
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
  }

  get(key: string): Promise<string | null> {
    return this.withTimeout(this.redis.get(key))
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs === undefined) await this.withTimeout(this.redis.set(key, value))
    else
      await this.withTimeout(
        this.redis.set(key, value, 'PX', Math.max(1, Math.ceil(ttlMs))),
      )
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length) await this.withTimeout(this.redis.del(...keys))
  }

  incr(key: string): Promise<number> {
    return this.withTimeout(this.redis.incr(key))
  }

  // SCAN (nunca KEYS): KEYS varre o banco inteiro de uma vez e trava o Redis
  // que também atende as filas.
  async scan(match: string): Promise<string[]> {
    const found = new Set<string>()
    let cursor = '0'
    do {
      const [next, keys] = await this.withTimeout(
        this.redis.scan(cursor, 'MATCH', match, 'COUNT', SCAN_COUNT),
      )
      cursor = next
      for (const k of keys) found.add(k)
    } while (cursor !== '0')
    return [...found]
  }
}
