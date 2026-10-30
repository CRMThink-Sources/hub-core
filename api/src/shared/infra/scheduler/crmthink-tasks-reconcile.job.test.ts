import { describe, expect, it, vi } from 'vitest'

vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock('@/modules/product-updates/main/make-sync-crmthink-task', () => ({
  makeReconcileCrmthinkTasks: vi.fn(),
}))

import { startCrmthinkTasksReconcileJob } from './crmthink-tasks-reconcile.job'

const setup = (
  overrides: { enabled?: boolean; token?: string | null } = {},
) => {
  let task: (() => Promise<void>) | undefined
  const schedule = vi.fn((_: string, fn: () => Promise<void>) => {
    task = fn
  })
  const execute = vi.fn().mockResolvedValue(undefined)
  const lock = {
    tryAcquire: vi
      .fn()
      .mockResolvedValue(
        overrides.token === undefined ? 'tok' : overrides.token,
      ),
    release: vi.fn().mockResolvedValue(undefined),
  }

  startCrmthinkTasksReconcileJob({
    enabled: overrides.enabled ?? true,
    schedule,
    lock,
    makeService: () => ({ execute }),
  })

  return { schedule, execute, lock, tick: () => task?.() }
}

describe('startCrmthinkTasksReconcileJob', () => {
  it('sincronização desligada não agenda', () => {
    const { schedule } = setup({ enabled: false })

    expect(schedule).not.toHaveBeenCalled()
  })

  it('agenda a cada hora no minuto 15', () => {
    const { schedule } = setup()

    expect(schedule).toHaveBeenCalledWith('15 * * * *', expect.any(Function))
  })

  it('com o lock livre reconcilia e solta o lock', async () => {
    const { execute, lock, tick } = setup()

    await tick()

    expect(execute).toHaveBeenCalledOnce()
    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('com o lock ocupado não reconcilia', async () => {
    const { execute, lock, tick } = setup({ token: null })

    await tick()

    expect(execute).not.toHaveBeenCalled()
    expect(lock.release).not.toHaveBeenCalled()
  })

  it('erro na rodada não escapa do tick e ainda solta o lock', async () => {
    const { execute, lock, tick } = setup()
    execute.mockRejectedValueOnce(new Error('boom'))

    await expect(tick()).resolves.toBeUndefined()
    expect(lock.release).toHaveBeenCalledWith('tok')
  })
})
