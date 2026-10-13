import type IORedis from 'ioredis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisSpaItemResourceMirrorRepository } from './redis-spa-item-resource-mirror.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

/** Redis falso com keyspace real, para o teste afirmar o valor gravado. */
const makeRedis = (seed: Record<string, string> = {}) => {
  const store = new Map(Object.entries(seed))

  const get = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null))
  const set = vi.fn((key: string, value: string, ...rest: unknown[]) => {
    store.set(key, value)
    return Promise.resolve('OK')
  })
  const del = vi.fn((key: string) => Promise.resolve(store.delete(key) ? 1 : 0))

  return {
    redis: { get, set, del } as unknown as IORedis,
    get,
    set,
    del,
    store,
  }
}

const KEY = 'payments:spa-item-resource:v1:77'

const ZAPI = {
  provider: 'ZAPI' as const,
  instanceId: 'inst-1',
  zApiToken: 'tok-1',
  subscriptionId: '42',
}

describe('RedisSpaItemResourceMirrorRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava sem TTL — o espelho não pode expirar antes da exclusão da linha', async () => {
    const { redis, set, store } = makeRedis()

    await new RedisSpaItemResourceMirrorRepository(redis).save('77', ZAPI)

    // Dois argumentos: chave e valor. Um terceiro seria `EX`/`PX`.
    expect(set).toHaveBeenCalledWith(KEY, JSON.stringify(ZAPI))
    expect(set.mock.calls[0]).toHaveLength(2)
    expect(JSON.parse(store.get(KEY)!)).toEqual(ZAPI)
  })

  it('nasce sem marca de desassinado', async () => {
    const { redis } = makeRedis()
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.save('77', ZAPI)

    expect(await repo.find('77')).toEqual(ZAPI)
    expect((await repo.find('77'))?.unsubscribedAt).toBeUndefined()
  })

  it('devolve null para item sem espelho', async () => {
    const { redis } = makeRedis()

    expect(
      await new RedisSpaItemResourceMirrorRepository(redis).find('99'),
    ).toBeNull()
  })

  it('trata entrada corrompida e shape inválido como ausência', async () => {
    const corrupted = makeRedis({ [KEY]: '{não é json' })
    const invalid = makeRedis({
      [KEY]: JSON.stringify({ provider: 'OUTRO', instanceId: 'x' }),
    })

    expect(
      await new RedisSpaItemResourceMirrorRepository(corrupted.redis).find(
        '77',
      ),
    ).toBeNull()
    expect(
      await new RedisSpaItemResourceMirrorRepository(invalid.redis).find('77'),
    ).toBeNull()
  })

  it('marca desassinado preservando a credencial', async () => {
    const { redis } = makeRedis({ [KEY]: JSON.stringify(ZAPI) })
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.setBillingState('77', 'unsubscribed')

    const mirror = await repo.find('77')
    expect(mirror?.unsubscribedAt).toEqual(expect.any(String))
    expect(mirror?.instanceId).toBe('inst-1')
    expect(mirror?.zApiToken).toBe('tok-1')
    expect(mirror?.subscriptionId).toBe('42')
  })

  it('marca assinado apagando a marca de desassinado — as duas são exclusivas', async () => {
    const { redis, store } = makeRedis({
      [KEY]: JSON.stringify({
        ...ZAPI,
        unsubscribedAt: '2026-08-01T00:00:00Z',
      }),
    })
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.setBillingState('77', 'subscribed')

    const stored = JSON.parse(store.get(KEY)!) as Record<string, unknown>

    // O campo sai do JSON, não vira `undefined`.
    expect(Object.keys(stored)).not.toContain('unsubscribedAt')
    expect((await repo.find('77'))?.subscribedAt).toEqual(expect.any(String))
    expect((await repo.find('77'))?.instanceId).toBe('inst-1')
  })

  it('marca desassinado apagando a marca de assinado', async () => {
    const { redis, store } = makeRedis({
      [KEY]: JSON.stringify({ ...ZAPI, subscribedAt: '2026-08-01T00:00:00Z' }),
    })
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.setBillingState('77', 'unsubscribed')

    const stored = JSON.parse(store.get(KEY)!) as Record<string, unknown>
    expect(Object.keys(stored)).not.toContain('subscribedAt')
    expect(stored.unsubscribedAt).toEqual(expect.any(String))
  })

  it('regravar o mesmo recurso preserva a marca de assinado', async () => {
    const { redis } = makeRedis({
      [KEY]: JSON.stringify({ ...ZAPI, subscribedAt: '2026-08-01T00:00:00Z' }),
    })
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.save('77', ZAPI)

    expect((await repo.find('77'))?.subscribedAt).toBe('2026-08-01T00:00:00Z')
  })

  it('gravar recurso diferente no mesmo item começa sem marca', async () => {
    const { redis } = makeRedis({
      [KEY]: JSON.stringify({ ...ZAPI, subscribedAt: '2026-08-01T00:00:00Z' }),
    })
    const repo = new RedisSpaItemResourceMirrorRepository(redis)

    await repo.save('77', { ...ZAPI, instanceId: 'inst-2' })

    const mirror = await repo.find('77')
    expect(mirror?.instanceId).toBe('inst-2')
    expect(mirror?.subscribedAt).toBeUndefined()
  })

  it('marcar item sem espelho é no-op, sem criar chave', async () => {
    const { redis, set, store } = makeRedis()

    await new RedisSpaItemResourceMirrorRepository(redis).setBillingState(
      '77',
      'subscribed',
    )

    expect(set).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('remove apaga a chave do item', async () => {
    const { redis, store } = makeRedis({ [KEY]: JSON.stringify(ZAPI) })

    await new RedisSpaItemResourceMirrorRepository(redis).remove('77')

    expect(store.has(KEY)).toBe(false)
  })
})
