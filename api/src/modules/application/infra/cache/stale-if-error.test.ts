import type IORedis from 'ioredis'
import z from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { staleKeyOf } from './keys'
import {
  STALE_TTL_SECONDS,
  loadWithStaleFallback,
  writeStale,
} from './stale-if-error'

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn, info: vi.fn(), error: vi.fn() },
}))

const schema = z.object({ id: z.string() })
const KEY = 'payments:plan:v3:production:7'
const bitrixDown = new Error('Failed to list CRM items')

function makeRedis(stored: Record<string, string> = {}) {
  const get = vi.fn((key: string) => Promise.resolve(stored[key] ?? null))
  const set = vi.fn(() => Promise.resolve('OK'))

  return { redis: { get, set } as unknown as IORedis, get, set }
}

const options = (redis: IORedis, load: () => Promise<{ id: string }>) => ({
  redis,
  key: KEY,
  schema,
  family: 'Plan',
  load,
})

describe('loadWithStaleFallback', () => {
  it('fonte respondendo: devolve da fonte e nem lê a reserva', async () => {
    const { redis, get } = makeRedis({
      [staleKeyOf(KEY)]: JSON.stringify({ id: 'velho' }),
    })

    const result = await loadWithStaleFallback(
      options(redis, () => Promise.resolve({ id: 'novo' })),
    )

    expect(result).toEqual({ value: { id: 'novo' }, stale: false })
    expect(get).not.toHaveBeenCalled()
  })

  it('fonte falhando com reserva: devolve a reserva marcada como stale e loga', async () => {
    const { redis } = makeRedis({
      [staleKeyOf(KEY)]: JSON.stringify({ id: 'reserva' }),
    })

    const result = await loadWithStaleFallback(
      options(redis, () => Promise.reject(bitrixDown)),
    )

    expect(result).toEqual({ value: { id: 'reserva' }, stale: true })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ key: staleKeyOf(KEY), error: bitrixDown }),
      expect.any(String),
    )
  })

  it('fonte falhando sem reserva: relança o erro original', async () => {
    const { redis } = makeRedis()

    await expect(
      loadWithStaleFallback(options(redis, () => Promise.reject(bitrixDown))),
    ).rejects.toBe(bitrixDown)
  })

  it('reserva com shape inválido conta como ausente', async () => {
    const { redis } = makeRedis({
      [staleKeyOf(KEY)]: JSON.stringify({ outro: 1 }),
    })

    await expect(
      loadWithStaleFallback(options(redis, () => Promise.reject(bitrixDown))),
    ).rejects.toBe(bitrixDown)
  })

  it('reserva corrompida conta como ausente', async () => {
    const { redis } = makeRedis({ [staleKeyOf(KEY)]: '{não-é-json' })

    await expect(
      loadWithStaleFallback(options(redis, () => Promise.reject(bitrixDown))),
    ).rejects.toBe(bitrixDown)
  })

  it('Redis fora na leitura da reserva: relança o erro da fonte, não o do Redis', async () => {
    const redis = {
      get: vi.fn(() => Promise.reject(new Error('redis down'))),
    } as unknown as IORedis

    await expect(
      loadWithStaleFallback(options(redis, () => Promise.reject(bitrixDown))),
    ).rejects.toBe(bitrixDown)
  })
})

describe('writeStale', () => {
  it('grava a reserva com TTL de 24 h', async () => {
    const { redis, set } = makeRedis()

    await writeStale(redis, KEY, { id: '7' })

    expect(set).toHaveBeenCalledWith(
      staleKeyOf(KEY),
      JSON.stringify({ id: '7' }),
      'EX',
      STALE_TTL_SECONDS,
    )
    expect(STALE_TTL_SECONDS).toBe(24 * 60 * 60)
  })

  it('falha de Redis é engolida', async () => {
    const redis = {
      set: vi.fn(() => Promise.reject(new Error('redis down'))),
    } as unknown as IORedis

    await expect(writeStale(redis, KEY, { id: '7' })).resolves.toBeUndefined()
  })
})
