import type { InsightsKv } from '@/modules/thinkzap/domain/ports/insights-kv.port'

type Entry = { value: string; expiresAt: number | null }

/**
 * `InsightsKv` em memória, com relógio injetável. Serve aos testes (e a quem
 * precisar rodar sem Redis): o TTL é conferido na leitura, como no Redis.
 */
export class MemoryInsightsKv implements InsightsKv {
  private readonly data = new Map<string, Entry>()

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string): Entry | undefined {
    const e = this.data.get(key)
    if (!e) return undefined
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.data.delete(key)
      return undefined
    }
    return e
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null)
  }

  set(key: string, value: string, ttlMs?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlMs === undefined ? null : this.now() + ttlMs,
    })
    return Promise.resolve()
  }

  del(keys: string[]): Promise<void> {
    for (const k of keys) this.data.delete(k)
    return Promise.resolve()
  }

  incr(key: string): Promise<number> {
    const next = Number(this.live(key)?.value ?? 0) + 1
    this.data.set(key, { value: String(next), expiresAt: null })
    return Promise.resolve(next)
  }

  scan(match: string): Promise<string[]> {
    const re = new RegExp(
      '^' +
        match
          .split('*')
          .map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$',
    )
    return Promise.resolve(
      [...this.data.keys()].filter(k => this.live(k) && re.test(k)),
    )
  }
}
