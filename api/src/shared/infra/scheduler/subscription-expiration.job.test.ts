import { describe, expect, it, vi } from 'vitest'

vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock('@/modules/application/main/make-expire-subscriptions', () => ({
  makeExpireSubscriptions: vi.fn(),
}))

import { startSubscriptionExpirationJob } from './subscription-expiration.job'

const setup = (overrides: { enabled?: boolean; lockFree?: boolean } = {}) => {
  let task: (() => Promise<void>) | undefined
  const schedule = vi.fn((_: string, fn: () => Promise<void>) => {
    task = fn
  })
  const execute = vi.fn().mockResolvedValue(undefined)
  const withLock = vi.fn(async (fn: () => Promise<void>) => {
    if (overrides.lockFree === false) return false
    await fn()
    return true
  })

  startSubscriptionExpirationJob({
    enabled: overrides.enabled ?? true,
    schedule,
    withLock,
    makeUseCase: () => ({ execute }),
  })

  return { schedule, execute, withLock, tick: () => task?.() }
}

describe('startSubscriptionExpirationJob', () => {
  it('desligado não agenda', () => {
    const { schedule } = setup({ enabled: false })

    expect(schedule).not.toHaveBeenCalled()
  })

  it('agenda a cada hora cheia', () => {
    const { schedule } = setup()

    expect(schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function))
  })

  it('com o lock livre executa uma vez', async () => {
    const { execute, tick } = setup()

    await tick()

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('com o lock ocupado pula a rodada', async () => {
    const { execute, withLock, tick } = setup({ lockFree: false })

    await tick()

    expect(withLock).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
  })

  it('erro na rodada não escapa do tick', async () => {
    const { execute, tick } = setup()
    execute.mockRejectedValueOnce(new Error('boom'))

    await expect(tick()).resolves.toBeUndefined()
  })
})
