import { describe, expect, it, vi } from 'vitest'
import { InsightsKvTimeoutError, RedisInsightsKv } from './redis-insights-kv'

function fakeRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    scan: vi.fn(),
  }
}

describe('RedisInsightsKv', () => {
  it('grava com TTL em milissegundos (PX) e sem TTL quando não informado', async () => {
    const redis = fakeRedis()
    const kv = new RedisInsightsKv(redis as never)
    await kv.set('k', 'v', 1500.2)
    await kv.set('k2', 'v2')
    expect(redis.set).toHaveBeenNthCalledWith(1, 'k', 'v', 'PX', 1501)
    expect(redis.set).toHaveBeenNthCalledWith(2, 'k2', 'v2')
  })

  it('percorre o SCAN até o cursor voltar a 0 e junta sem duplicar', async () => {
    const redis = fakeRedis()
    redis.scan
      .mockResolvedValueOnce(['7', ['a', 'b']])
      .mockResolvedValueOnce(['0', ['b', 'c']])
    const kv = new RedisInsightsKv(redis as never)
    expect((await kv.scan('insights:*')).sort()).toEqual(['a', 'b', 'c'])
    expect(redis.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'insights:*',
      'COUNT',
      200,
    )
    expect(redis.scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'insights:*',
      'COUNT',
      200,
    )
  })

  it('não chama o DEL com lista vazia (o Redis recusa)', async () => {
    const redis = fakeRedis()
    const kv = new RedisInsightsKv(redis as never)
    await kv.del([])
    expect(redis.del).not.toHaveBeenCalled()
    await kv.del(['x', 'y'])
    expect(redis.del).toHaveBeenCalledWith('x', 'y')
  })

  it('Redis que não responde não prende o chamador: erro depois do teto', async () => {
    const redis = fakeRedis()
    redis.get.mockReturnValue(new Promise(() => {})) // nunca resolve
    redis.scan.mockReturnValue(new Promise(() => {}))
    const kv = new RedisInsightsKv(redis as never, 20)

    await expect(kv.get('k')).rejects.toBeInstanceOf(InsightsKvTimeoutError)
    await expect(kv.scan('x*')).rejects.toBeInstanceOf(InsightsKvTimeoutError)
  })

  it('resposta dentro do teto passa normalmente', async () => {
    const redis = fakeRedis()
    redis.get.mockResolvedValue('v')
    const kv = new RedisInsightsKv(redis as never, 1000)
    await expect(kv.get('k')).resolves.toBe('v')
  })
})
