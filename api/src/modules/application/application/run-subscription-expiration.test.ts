import { describe, expect, it, vi } from 'vitest'
import { SubscriptionExpirationResult } from '@/modules/application/domain/entities/subscription-expiration-run'
import { SubscriptionExpirationRunRepository } from '@/modules/application/domain/repositories/subscription-expiration-run.repository'
import { RunSubscriptionExpiration } from './run-subscription-expiration'

const NOW = new Date('2026-10-13T12:00:00Z')

const emptyResult = (): SubscriptionExpirationResult => ({
  checked: 0,
  trialExpired: 0,
  pastDue: 0,
  failed: 0,
  paused: false,
  changes: [],
})

const make = (execute = vi.fn().mockResolvedValue(emptyResult())) => {
  const runs = {
    start: vi.fn().mockResolvedValue('run-1'),
    finish: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
    findById: vi.fn(),
    deleteStartedBefore: vi.fn(),
  } satisfies SubscriptionExpirationRunRepository

  return {
    service: new RunSubscriptionExpiration({ execute }, runs, () => NOW),
    runs,
    execute,
  }
}

describe('RunSubscriptionExpiration', () => {
  it('rodada vazia é registrada e termina com sucesso', async () => {
    const { service, runs } = make()

    await service.run({ trigger: 'scheduled' })

    expect(runs.start).toHaveBeenCalledWith({ trigger: 'scheduled' })
    expect(runs.finish).toHaveBeenCalledWith('run-1', emptyResult(), NOW)
    expect(runs.fail).not.toHaveBeenCalled()
  })

  it('repassa trigger e usuário', async () => {
    const { service, runs } = make()

    await service.begin({ trigger: 'manual', portalUserId: 'user-1' })

    expect(runs.start).toHaveBeenCalledWith({
      trigger: 'manual',
      portalUserId: 'user-1',
    })
  })

  it('erro da varredura registra falha com a mensagem e sobe', async () => {
    const { service, runs } = make(vi.fn().mockRejectedValue(new Error('rede')))

    await expect(service.run({ trigger: 'scheduled' })).rejects.toThrow('rede')
    expect(runs.fail).toHaveBeenCalledWith('run-1', 'rede', NOW)
    expect(runs.finish).not.toHaveBeenCalled()
  })

  it('falha ao gravar o resultado não derruba a rodada', async () => {
    const { service, runs } = make()
    runs.finish.mockRejectedValue(new Error('db fora'))

    await expect(service.run({ trigger: 'scheduled' })).resolves.toEqual(
      emptyResult(),
    )
  })

  it('falha ao registrar o início roda a varredura mesmo assim', async () => {
    const { service, runs, execute } = make()
    runs.start.mockRejectedValue(new Error('db fora'))

    await service.run({ trigger: 'scheduled' })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(runs.finish).not.toHaveBeenCalled()
  })
})
