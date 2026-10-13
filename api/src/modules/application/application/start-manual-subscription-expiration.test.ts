import { describe, expect, it, vi } from 'vitest'
import { StartManualSubscriptionExpiration } from './start-manual-subscription-expiration'

const make = (
  overrides: {
    enabled?: boolean
    token?: string | null
    complete?: () => Promise<unknown>
    begin?: () => Promise<string>
  } = {},
) => {
  const lock = {
    tryAcquire: vi
      .fn()
      .mockResolvedValue(
        overrides.token === undefined ? 'tok' : overrides.token,
      ),
    release: vi.fn().mockResolvedValue(undefined),
  }
  const service = {
    begin: vi.fn(overrides.begin ?? (() => Promise.resolve('run-1'))),
    complete: vi.fn(overrides.complete ?? (() => Promise.resolve({}))),
  }

  return {
    useCase: new StartManualSubscriptionExpiration(
      overrides.enabled ?? true,
      lock,
      service as unknown as ConstructorParameters<
        typeof StartManualSubscriptionExpiration
      >[2],
    ),
    lock,
    service,
  }
}

/** Deixa a cadeia em background (`complete` → `catch` → `finally`) assentar. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('StartManualSubscriptionExpiration', () => {
  it('desligado não toca no lock nem registra', async () => {
    const { useCase, lock, service } = make({ enabled: false })

    await expect(useCase.execute('user-1')).resolves.toEqual({
      status: 'disabled',
    })
    expect(lock.tryAcquire).not.toHaveBeenCalled()
    expect(service.begin).not.toHaveBeenCalled()
  })

  it('lock ocupado devolve busy sem registrar', async () => {
    const { useCase, service } = make({ token: null })

    await expect(useCase.execute('user-1')).resolves.toEqual({
      status: 'busy',
    })
    expect(service.begin).not.toHaveBeenCalled()
  })

  it('registra rodada manual, responde e solta o lock ao terminar', async () => {
    const { useCase, lock, service } = make()

    await expect(useCase.execute('user-1')).resolves.toEqual({
      status: 'started',
      runId: 'run-1',
    })
    expect(service.begin).toHaveBeenCalledWith({
      trigger: 'manual',
      portalUserId: 'user-1',
    })

    await flush()
    expect(service.complete).toHaveBeenCalledWith('run-1')
    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('solta o lock mesmo quando a varredura falha', async () => {
    const { useCase, lock } = make({
      complete: () => Promise.reject(new Error('rede')),
    })

    await useCase.execute('user-1')
    await flush()

    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('falha ao registrar solta o lock e sobe', async () => {
    const { useCase, lock, service } = make({
      begin: () => Promise.reject(new Error('db fora')),
    })

    await expect(useCase.execute('user-1')).rejects.toThrow('db fora')
    expect(lock.release).toHaveBeenCalledWith('tok')
    expect(service.complete).not.toHaveBeenCalled()
  })
})
