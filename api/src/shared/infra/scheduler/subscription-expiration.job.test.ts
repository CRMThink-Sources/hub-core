import { describe, expect, it, vi } from 'vitest'

vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock('@/modules/application/main/make-run-subscription-expiration', () => ({
  makeRunSubscriptionExpiration: vi.fn(),
  makeSubscriptionExpirationRunRepository: vi.fn(),
}))

import { startSubscriptionExpirationJob } from './subscription-expiration.job'

const NOW = new Date('2026-10-13T12:00:00Z')

const setup = (
  overrides: { enabled?: boolean; token?: string | null } = {},
) => {
  let task: (() => Promise<void>) | undefined
  const schedule = vi.fn((_: string, fn: () => Promise<void>) => {
    task = fn
  })
  const run = vi.fn().mockResolvedValue(undefined)
  const lock = {
    tryAcquire: vi
      .fn()
      .mockResolvedValue(
        overrides.token === undefined ? 'tok' : overrides.token,
      ),
    release: vi.fn().mockResolvedValue(undefined),
  }
  const cleanup = vi.fn().mockResolvedValue(0)

  startSubscriptionExpirationJob({
    enabled: overrides.enabled ?? true,
    schedule,
    lock,
    makeService: () => ({ run }),
    cleanup,
    clock: () => NOW,
  })

  return { schedule, run, lock, cleanup, tick: () => task?.() }
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

  it('com o lock livre registra uma rodada agendada, limpa e solta o lock', async () => {
    const { run, cleanup, lock, tick } = setup()

    await tick()

    expect(run).toHaveBeenCalledWith({ trigger: 'scheduled' })
    expect(cleanup).toHaveBeenCalledWith(new Date('2026-07-15T12:00:00Z'))
    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('com o lock ocupado não registra nem limpa', async () => {
    const { run, cleanup, lock, tick } = setup({ token: null })

    await tick()

    expect(run).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
    expect(lock.release).not.toHaveBeenCalled()
  })

  it('erro na rodada não escapa do tick e ainda solta o lock', async () => {
    const { run, lock, tick } = setup()
    run.mockRejectedValueOnce(new Error('boom'))

    await expect(tick()).resolves.toBeUndefined()
    expect(lock.release).toHaveBeenCalledWith('tok')
  })
})
