import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { scanDelete } from './scan-delete'
import {
  SUBSCRIPTION_ITEM_SCAN_PATTERNS,
  SUBSCRIPTION_SCAN_PATTERNS,
} from './keys'

/**
 * Redis falso com um keyspace real: o `scan` filtra por glob e devolve as chaves em
 * páginas, para que o teste exercite o cursor em vez de confiar num mock que devolve
 * tudo de uma vez.
 */
const makeRedis = (keyspace: string[], pageSize = 2) => {
  const remaining = new Set(keyspace)

  const scan = vi.fn((cursor: string, _match: string, pattern: string) => {
    const matching = [...remaining].filter(key =>
      new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
      ).test(key),
    )

    const start = Number(cursor)
    const page = matching.slice(start, start + pageSize)
    const next =
      start + pageSize >= matching.length ? '0' : String(start + pageSize)

    return Promise.resolve([next, page] as [string, string[]])
  })

  const del = vi.fn((...keys: string[]) => {
    let removed = 0
    for (const key of keys) if (remaining.delete(key)) removed++
    return Promise.resolve(removed)
  })

  return { redis: { scan, del } as unknown as IORedis, scan, del, remaining }
}

describe('scanDelete', () => {
  it('percorre o cursor até o fim e apaga tudo que casa com o padrão', async () => {
    const { redis, del, remaining } = makeRedis([
      'payments:subscription:v4:1',
      'payments:subscription:v4:2',
      'payments:subscription:v4:3',
      'payments:subscriptions:v4:all',
      'payments:subscriptions:v4:aplication:9',
    ])

    const deleted = await scanDelete(redis, SUBSCRIPTION_SCAN_PATTERNS)

    expect(deleted).toBe(5)
    expect(remaining.size).toBe(0)
    // Mais de uma página por padrão: o cursor foi seguido, não abandonado no primeiro SCAN.
    expect(del).toHaveBeenCalled()
  })

  it('não alcança chaves de item ao varrer a família de assinatura', async () => {
    const { redis, remaining } = makeRedis([
      'payments:subscription:v4:1',
      'payments:subscription-item:v4:77',
      'payments:subscription-items:v4:all',
      'payments:subscription-items:v4:subscription:1',
    ])

    const deleted = await scanDelete(redis, SUBSCRIPTION_SCAN_PATTERNS)

    expect(deleted).toBe(1)
    expect([...remaining]).toEqual([
      'payments:subscription-item:v4:77',
      'payments:subscription-items:v4:all',
      'payments:subscription-items:v4:subscription:1',
    ])
  })

  it('varre a família de item sem tocar na de assinatura', async () => {
    const { redis, remaining } = makeRedis([
      'payments:subscription:v4:1',
      'payments:subscriptions:v4:all',
      'payments:subscription-item:v4:77',
      'payments:subscription-items:v4:all',
    ])

    const deleted = await scanDelete(redis, SUBSCRIPTION_ITEM_SCAN_PATTERNS)

    expect(deleted).toBe(2)
    expect([...remaining]).toEqual([
      'payments:subscription:v4:1',
      'payments:subscriptions:v4:all',
    ])
  })

  it('usa SCAN cursorizado com COUNT, nunca KEYS', async () => {
    const { redis, scan } = makeRedis(['payments:plan:v2:1'])

    await scanDelete(redis, ['payments:plan:v2:*'])

    expect(scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'payments:plan:v2:*',
      'COUNT',
      500,
    )
    expect((redis as unknown as { keys?: unknown }).keys).toBeUndefined()
  })

  it('não chama DEL quando nada casa', async () => {
    const { redis, del } = makeRedis(['bull:thinkzap-inbound:1'])

    const deleted = await scanDelete(redis, SUBSCRIPTION_SCAN_PATTERNS)

    expect(deleted).toBe(0)
    expect(del).not.toHaveBeenCalled()
  })
})
