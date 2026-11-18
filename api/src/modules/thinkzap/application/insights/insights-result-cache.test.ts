import { describe, expect, it, vi } from 'vitest'
import { InsightsResultCache, insightsCacheKey } from './insights-result-cache'

describe('InsightsResultCache', () => {
  it('reaproveita o resultado dentro do TTL e recarrega depois dele', async () => {
    let now = 1_000
    const cache = new InsightsResultCache(() => now)
    const load = vi.fn(() => Promise.resolve('v'))

    await cache.getOrLoad('a', 'k', 60_000, load)
    now += 59_999
    await cache.getOrLoad('a', 'k', 60_000, load)
    expect(load).toHaveBeenCalledTimes(1)

    now += 2
    await cache.getOrLoad('a', 'k', 60_000, load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('separa por app e por chave', async () => {
    const cache = new InsightsResultCache(() => 0)
    const load = vi.fn(() => Promise.resolve('v'))
    await cache.getOrLoad('a', 'k1', 1000, load)
    await cache.getOrLoad('a', 'k2', 1000, load)
    await cache.getOrLoad('b', 'k1', 1000, load)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('invalidate limpa só o app indicado', async () => {
    const cache = new InsightsResultCache(() => 0)
    const load = vi.fn(() => Promise.resolve('v'))
    await cache.getOrLoad('a', 'k', 1000, load)
    await cache.getOrLoad('b', 'k', 1000, load)
    cache.invalidate('a')
    await cache.getOrLoad('a', 'k', 1000, load)
    await cache.getOrLoad('b', 'k', 1000, load)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('não guarda falha: a próxima chamada tenta de novo', async () => {
    const cache = new InsightsResultCache(() => 0)
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue('ok')
    await expect(cache.getOrLoad('a', 'k', 1000, load)).rejects.toThrow('x')
    await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('ok')
  })

  it('a chave ignora a ordem das chaves e valores indefinidos', () => {
    expect(insightsCacheKey('today', { a: '1', b: '2', c: undefined })).toBe(
      insightsCacheKey('today', { b: '2', a: '1' }),
    )
    expect(insightsCacheKey('today', {})).not.toBe(
      insightsCacheKey('dashboard', {}),
    )
  })
})
