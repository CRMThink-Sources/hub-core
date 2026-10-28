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
  linesUnsubscribed: 0,
  cancelled: 0,
  linesChecked: 0,
  linesSubscribed: 0,
  reconciliation: false,
  providerStepsSkipped: false,
  paused: false,
  changes: [],
})

const make = (
  execute = vi.fn().mockResolvedValue(emptyResult()),
  options: { now?: Date; reconciledToday?: boolean } = {},
) => {
  const runs = {
    start: vi.fn().mockResolvedValue('run-1'),
    finish: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
    findById: vi.fn(),
    deleteStartedBefore: vi.fn(),
    hasReconciliationSince: vi
      .fn()
      .mockResolvedValue(options.reconciledToday ?? false),
  } satisfies SubscriptionExpirationRunRepository

  return {
    service: new RunSubscriptionExpiration(
      { execute },
      runs,
      () => options.now ?? NOW,
      { hour: 3, timeZone: 'America/Sao_Paulo' },
    ),
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

describe('RunSubscriptionExpiration — janela diária da reconciliação', () => {
  /** 02:00, 03:00 e 04:00 em São Paulo (UTC-3). */
  const at = (localHour: number) =>
    new Date(Date.UTC(2026, 10, 8, localHour + 3, 0, 0))

  it('02:00 não reconcilia', async () => {
    const { service, execute } = make(undefined, { now: at(2) })

    await service.run({ trigger: 'scheduled' })

    expect(execute).toHaveBeenCalledWith(at(2), { reconcile: false })
  })

  it('03:00 reconcilia', async () => {
    const { service, execute, runs } = make(undefined, { now: at(3) })

    await service.run({ trigger: 'scheduled' })

    expect(execute).toHaveBeenCalledWith(at(3), { reconcile: true })
    expect(runs.hasReconciliationSince).toHaveBeenCalledWith(
      new Date(Date.UTC(2026, 10, 8, 3, 0, 0)),
    )
  })

  it('04:00 depois de uma reconciliação hoje não reconcilia', async () => {
    const { service, execute } = make(undefined, {
      now: at(4),
      reconciledToday: true,
    })

    await service.run({ trigger: 'scheduled' })

    expect(execute).toHaveBeenCalledWith(at(4), { reconcile: false })
  })

  it('04:00 sem reconciliação hoje (a das 03:00 caiu) reconcilia', async () => {
    const { service, execute } = make(undefined, { now: at(4) })

    await service.run({ trigger: 'scheduled' })

    expect(execute).toHaveBeenCalledWith(at(4), { reconcile: true })
  })

  it('manual sempre reconcilia', async () => {
    const { service, execute } = make(undefined, { now: at(2) })

    await service.run({ trigger: 'manual', portalUserId: 'user-1' })

    expect(execute).toHaveBeenCalledWith(at(2), { reconcile: true })
  })
})
