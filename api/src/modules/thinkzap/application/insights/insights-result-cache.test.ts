import { describe, expect, it, vi } from 'vitest'
import {
  InsightsResultCache,
  STALE_MAX_MS,
  insightsCacheKey,
} from './insights-result-cache'

const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('InsightsResultCache', () => {
  it('reaproveita o resultado dentro do TTL e recarrega depois dele', async () => {
    let now = 1_000
    const cache = new InsightsResultCache(() => now)
    const load = vi.fn(() => Promise.resolve('v'))

    await cache.getOrLoad('a', 'k', 60_000, load)
    now += 59_999
    await cache.getOrLoad('a', 'k', 60_000, load)
    expect(load).toHaveBeenCalledTimes(1)

    // Expirada: serve a antiga na hora e recarrega em segundo plano.
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

  it('cargas simultâneas da mesma chave compartilham a promessa', async () => {
    const cache = new InsightsResultCache(() => 0)
    const d = deferred<string>()
    const load = vi.fn(() => d.promise)

    const a = cache.getOrLoad('a', 'k', 1000, load)
    const b = cache.getOrLoad('a', 'k', 1000, load)
    d.resolve('v')

    await expect(Promise.all([a, b])).resolves.toEqual(['v', 'v'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('carga em andamento que falha é removida e não é cacheada', async () => {
    const cache = new InsightsResultCache(() => 0)
    const d = deferred<string>()
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(d.promise)
      .mockResolvedValue('ok')

    const a = cache.getOrLoad('a', 'k', 1000, load)
    const b = cache.getOrLoad('a', 'k', 1000, load)
    d.reject(new Error('x'))
    await expect(a).rejects.toThrow('x')
    await expect(b).rejects.toThrow('x')

    await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(2)
  })

  describe('stale-while-revalidate', () => {
    it('serve a entrada expirada na hora e recarrega em segundo plano, uma só vez', async () => {
      let now = 0
      const cache = new InsightsResultCache(() => now)
      await cache.getOrLoad('a', 'k', 1000, () => Promise.resolve('velho'))
      now = 1001
      const d = deferred<string>()
      const load = vi.fn(() => d.promise)

      const first = await cache.getOrLoad('a', 'k', 1000, load)
      const second = await cache.getOrLoad('a', 'k', 1000, load)

      expect(first).toBe('velho')
      expect(second).toBe('velho')
      expect(load).toHaveBeenCalledTimes(1)

      d.resolve('novo')
      await new Promise(resolve => setTimeout(resolve, 0))
      await expect(
        cache.getOrLoad('a', 'k', 1000, () => Promise.resolve('x')),
      ).resolves.toBe('novo')
    })

    it('falha da recarga em segundo plano mantém a entrada antiga, sem unhandled rejection', async () => {
      let now = 0
      const cache = new InsightsResultCache(() => now)
      await cache.getOrLoad('a', 'k', 1000, () => Promise.resolve('velho'))
      now = 2000
      const unhandled = vi.fn()
      process.on('unhandledRejection', unhandled)
      const load = vi
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('boom'))

      await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('velho')
      await new Promise(resolve => setTimeout(resolve, 0))
      process.off('unhandledRejection', unhandled)

      expect(unhandled).not.toHaveBeenCalled()
      // Continua servível (e tenta recarregar de novo).
      await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('velho')
      expect(load).toHaveBeenCalledTimes(2)
    })

    it('além de STALE_MAX_MS a carga é bloqueante', async () => {
      let now = 0
      const cache = new InsightsResultCache(() => now)
      await cache.getOrLoad('a', 'k', 1000, () => Promise.resolve('velho'))
      now = 1000 + STALE_MAX_MS
      const load = vi.fn(() => Promise.resolve('novo'))

      await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('novo')
      expect(load).toHaveBeenCalledTimes(1)
    })
  })

  describe('invalidate e cargas em andamento', () => {
    it('carga iniciada antes da invalidação não grava o resultado antigo', async () => {
      const cache = new InsightsResultCache(() => 0)
      const old = deferred<string>()

      const pending = cache.getOrLoad('a', 'k', 1000, () => old.promise)
      cache.invalidate('a')
      old.resolve('antigo')
      await expect(pending).resolves.toBe('antigo')

      const load = vi.fn(() => Promise.resolve('novo'))
      await expect(cache.getOrLoad('a', 'k', 1000, load)).resolves.toBe('novo')
      expect(load).toHaveBeenCalledTimes(1)
    })

    it('após invalidar, a chamada seguinte não reaproveita a carga antiga nem é sobrescrita por ela', async () => {
      const cache = new InsightsResultCache(() => 0)
      const old = deferred<string>()
      const loadNew = vi.fn(() => Promise.resolve('novo'))

      const pending = cache.getOrLoad('a', 'k', 1000, () => old.promise)
      cache.invalidate('a')

      await expect(cache.getOrLoad('a', 'k', 1000, loadNew)).resolves.toBe(
        'novo',
      )
      old.resolve('antigo')
      await pending
      await expect(
        cache.getOrLoad('a', 'k', 1000, () => Promise.resolve('x')),
      ).resolves.toBe('novo')
    })
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
