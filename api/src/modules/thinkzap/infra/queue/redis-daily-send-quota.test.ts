import { describe, expect, it } from 'vitest'
import type IORedis from 'ioredis'
import {
  ADD_EXTRA_SCRIPT,
  RELEASE_SCRIPT,
  RESERVE_SCRIPT,
  RedisDailySendQuota,
  dailyExtraKey,
  dailySentKey,
} from './redis-daily-send-quota'

/**
 * Redis de mentira que executa cada script com a mesma semântica do Lua, de forma
 * síncrona dentro da chamada — como o Redis, que roda um script por vez. É o que
 * permite provar que a decisão e a contagem acontecem no mesmo passo.
 */
function fakeRedis() {
  const store = new Map<string, string>()
  const get = (key: string) => Number(store.get(key) ?? '0')

  const evalScript = (script: string, _n: number, ...args: string[]) => {
    if (script === RESERVE_SCRIPT) {
      const [sentKey, extraKey, enabled, limit] = args as [
        string,
        string,
        string,
        string,
      ]
      const sent = get(sentKey)
      const extra = get(extraKey)
      if (enabled === '1' && sent >= Number(limit) + extra) {
        return Promise.resolve([0, sent, extra])
      }
      store.set(sentKey, String(sent + 1))
      return Promise.resolve([1, sent + 1, extra])
    }
    if (script === RELEASE_SCRIPT) {
      const [sentKey] = args as [string]
      const v = get(sentKey)
      if (v > 0) store.set(sentKey, String(v - 1))
      return Promise.resolve(Math.max(0, v - 1))
    }
    if (script === ADD_EXTRA_SCRIPT) {
      const [extraKey, amount] = args as [string, string]
      store.set(extraKey, String(get(extraKey) + Number(amount)))
      return Promise.resolve(get(extraKey))
    }
    throw new Error('script desconhecido')
  }

  const mget = (...keys: string[]) =>
    Promise.resolve(keys.map(key => store.get(key) ?? null))

  const del = (...keys: string[]) => {
    for (const key of keys) store.delete(key)
    return Promise.resolve(keys.length)
  }

  const redis = { eval: evalScript, mget, del } as unknown as IORedis
  return { redis, store }
}

// 12:00 em Brasília.
const NOW = new Date('2026-10-16T15:00:00.000Z')
const CHANNEL = 'canal-1'

const policy = (enabled: boolean, limit: number) => ({
  lineKey: CHANNEL,
  enabled,
  limit,
})

describe('RedisDailySendQuota', () => {
  it('com o limite desligado, a reserva sempre soma', async () => {
    const { redis } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    for (let i = 0; i < 5; i++) {
      const result = await quota.reserve(policy(false, 1), NOW)
      expect(result.status).toBe('reserved')
    }

    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 5, extra: 0 })
  })

  it('com o limite ligado, recusa ao alcançar o limite e não conta a recusa', async () => {
    const { redis } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    expect((await quota.reserve(policy(true, 2), NOW)).status).toBe('reserved')
    expect((await quota.reserve(policy(true, 2), NOW)).status).toBe('reserved')

    const refused = await quota.reserve(policy(true, 2), NOW)
    expect(refused).toEqual({
      status: 'refused',
      counts: { sent: 2, extra: 0 },
      effectiveLimit: 2,
    })
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 2, extra: 0 })
  })

  it('os extras do dia ampliam o limite e somam entre si', async () => {
    const { redis } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    await quota.reserve(policy(true, 1), NOW)
    expect((await quota.reserve(policy(true, 1), NOW)).status).toBe('refused')

    await quota.addExtra(CHANNEL, 1, NOW)
    expect(await quota.addExtra(CHANNEL, 2, NOW)).toEqual({ sent: 1, extra: 3 })

    for (let i = 0; i < 3; i++) {
      expect((await quota.reserve(policy(true, 1), NOW)).status).toBe(
        'reserved',
      )
    }
    expect((await quota.reserve(policy(true, 1), NOW)).status).toBe('refused')
  })

  it('a chave muda com o dia de Brasília: contagem e extras de ontem não valem hoje', async () => {
    const { redis, store } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)
    // 23:30 de 15/10 em Brasília, já 16/10 em UTC.
    const lateYesterday = new Date('2026-10-16T02:30:00.000Z')

    await quota.reserve(policy(true, 1), lateYesterday)
    await quota.addExtra(CHANNEL, 10, lateYesterday)

    expect(store.has(dailySentKey(CHANNEL, '2026-10-15'))).toBe(true)
    expect(store.has(dailyExtraKey(CHANNEL, '2026-10-15'))).toBe(true)
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 0, extra: 0 })
  })

  it('release devolve a vaga uma vez só e nunca fica negativo', async () => {
    const { redis, store } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    const result = await quota.reserve(policy(true, 1), NOW)
    if (result.status !== 'reserved') throw new Error('esperava reserva')

    await result.reservation.release()
    await result.reservation.release()
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 0, extra: 0 })

    // Chave sumiu (TTL/flush) entre reservar e devolver.
    const other = await quota.reserve(policy(true, 1), NOW)
    if (other.status !== 'reserved') throw new Error('esperava reserva')
    store.clear()
    await other.reservation.release()
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 0, extra: 0 })
  })

  it('wouldRefuse lê sem reservar', async () => {
    const { redis } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    expect(await quota.wouldRefuse(policy(true, 1), NOW)).toBe(false)
    await quota.reserve(policy(true, 1), NOW)
    expect(await quota.wouldRefuse(policy(true, 1), NOW)).toBe(true)
    expect(await quota.wouldRefuse(policy(false, 1), NOW)).toBe(false)
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 1, extra: 0 })
  })

  /**
   * Cenário "Envios simultâneos na última vaga". A garantia real é do Redis, que
   * executa um script por vez; aqui se prova que a decisão e a soma estão no mesmo
   * script, então dois pedidos simultâneos não leem o mesmo "ainda cabe".
   */
  it('duas reservas simultâneas na última vaga: só uma passa', async () => {
    const { redis } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)

    for (let i = 0; i < 299; i++) await quota.reserve(policy(true, 300), NOW)

    const results = await Promise.all([
      quota.reserve(policy(true, 300), NOW),
      quota.reserve(policy(true, 300), NOW),
    ])

    expect(results.map(r => r.status).sort()).toEqual(['refused', 'reserved'])
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 300, extra: 0 })
  })
})

describe('RedisDailySendQuota.resetDay', () => {
  it('zera contagem e extras só do dia e devolve o que havia', async () => {
    const { redis, store } = fakeRedis()
    const quota = new RedisDailySendQuota(redis)
    const ontem = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)

    await quota.reserve(policy(false, 1), NOW)
    await quota.reserve(policy(false, 1), NOW)
    await quota.addExtra(CHANNEL, 50, NOW)
    await quota.reserve(policy(false, 1), ontem)

    expect(await quota.resetDay(CHANNEL, NOW)).toEqual({ sent: 2, extra: 50 })
    expect(await quota.usage(CHANNEL, NOW)).toEqual({ sent: 0, extra: 0 })
    expect(await quota.usage(CHANNEL, ontem)).toEqual({ sent: 1, extra: 0 })
    expect(store.size).toBe(1)
  })
})
