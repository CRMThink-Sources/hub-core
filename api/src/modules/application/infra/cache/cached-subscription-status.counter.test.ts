import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionStatusCounts } from '@/modules/application/domain/repositories/subscription-status.counter'
import {
  CachedSubscriptionStatusCounter,
  SUBSCRIPTION_STATUS_COUNTS_TTL_SECONDS,
  subscriptionStatusCountsKey,
} from './cached-subscription-status.counter'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const counts: SubscriptionStatusCounts = {
  active: 94,
  pastDue: 6,
  trialing: 12,
  countedAt: new Date('2026-10-28T12:00:00Z'),
}

/** Redis em memória: o que foi gravado volta na leitura seguinte. */
function makeMemoryRedis() {
  const store = new Map<string, string>()
  const get = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null))
  const set = vi.fn((key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve('OK')
  })
  return { redis: { get, set } as unknown as IORedis, get, set }
}

describe('CachedSubscriptionStatusCounter', () => {
  it('duas leituras seguidas consultam a contagem uma vez só', async () => {
    const inner = { count: vi.fn(() => Promise.resolve(counts)) }
    const { redis } = makeMemoryRedis()
    const counter = new CachedSubscriptionStatusCounter(inner, redis)

    const first = await counter.count()
    const second = await counter.count()

    expect(inner.count).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
    expect(second.countedAt).toEqual(counts.countedAt)
  })

  it('grava com TTL de 60 segundos', async () => {
    const inner = { count: vi.fn(() => Promise.resolve(counts)) }
    const { redis, set } = makeMemoryRedis()

    await new CachedSubscriptionStatusCounter(inner, redis).count()

    expect(set).toHaveBeenCalledWith(
      subscriptionStatusCountsKey(),
      expect.any(String),
      'EX',
      SUBSCRIPTION_STATUS_COUNTS_TTL_SECONDS,
    )
    expect(SUBSCRIPTION_STATUS_COUNTS_TTL_SECONDS).toBe(60)
  })

  it('não cacheia falha da contagem', async () => {
    const inner = {
      count: vi
        .fn<() => Promise<SubscriptionStatusCounts>>()
        .mockRejectedValueOnce(new Error('bitrix down'))
        .mockResolvedValueOnce(counts),
    }
    const { redis, set } = makeMemoryRedis()
    const counter = new CachedSubscriptionStatusCounter(inner, redis)

    await expect(counter.count()).rejects.toThrow('bitrix down')
    expect(set).not.toHaveBeenCalled()
    await expect(counter.count()).resolves.toEqual(counts)
  })

  it('Redis fora do ar vira leitura direta', async () => {
    const inner = { count: vi.fn(() => Promise.resolve(counts)) }
    const redis = {
      get: vi.fn(() => Promise.reject(new Error('redis down'))),
      set: vi.fn(() => Promise.reject(new Error('redis down'))),
    } as unknown as IORedis

    await expect(
      new CachedSubscriptionStatusCounter(inner, redis).count(),
    ).resolves.toEqual(counts)
  })

  it('entrada com shape velho é ignorada', async () => {
    const inner = { count: vi.fn(() => Promise.resolve(counts)) }
    const { redis } = makeMemoryRedis()
    await redis.set(
      subscriptionStatusCountsKey(),
      JSON.stringify({ active: 1 }),
    )

    await new CachedSubscriptionStatusCounter(inner, redis).count()

    expect(inner.count).toHaveBeenCalledTimes(1)
  })
})
