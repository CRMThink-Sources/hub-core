import { describe, expect, it, vi } from 'vitest'
import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { ExpireSubscriptions } from './expire-subscriptions'

const NOW = new Date('2026-10-13T12:00:00Z')
const YESTERDAY_END = new Date('2026-10-12T23:59:59.999Z')

const sub = (
  id: string,
  overrides: Partial<ExpirableSubscription> = {},
): ExpirableSubscription => ({
  id,
  status: 'active',
  modality: 'manual',
  currentPeriodEnd: YESTERDAY_END,
  ...overrides,
})

const make = (
  candidates: ExpirableSubscription[],
  updateSubscription = vi.fn().mockResolvedValue({}),
  graceDays = 0,
) => ({
  useCase: new ExpireSubscriptions(
    { listExpiring: vi.fn().mockResolvedValue(candidates) },
    { updateSubscription },
    graceDays,
  ),
  updateSubscription,
})

describe('ExpireSubscriptions', () => {
  it('grava trial_expired no trial e past_due na manual, só o status', async () => {
    const { useCase, updateSubscription } = make([
      sub('1', { status: 'trialing' }),
      sub('2'),
    ])

    const summary = await useCase.execute(NOW)

    expect(updateSubscription.mock.calls).toEqual([
      ['1', { status: 'trial_expired' }],
      ['2', { status: 'past_due' }],
    ])
    expect(summary).toEqual({
      checked: 2,
      trialExpired: 1,
      pastDue: 1,
      failed: 0,
      paused: false,
    })
  })

  it('não grava stripe, assinatura no último dia nem manual dentro da carência', async () => {
    const { useCase, updateSubscription } = make(
      [
        sub('1', { modality: 'stripe' }),
        sub('2', { currentPeriodEnd: new Date('2026-10-13T23:59:59.999Z') }),
        sub('3'),
      ],
      undefined,
      3,
    )

    await useCase.execute(NOW)

    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('falha em uma não impede a seguinte', async () => {
    const updateSubscription = vi
      .fn()
      .mockRejectedValueOnce(new Error('bitrix fora'))
      .mockResolvedValueOnce({})
    const { useCase } = make([sub('1'), sub('2')], updateSubscription)

    const summary = await useCase.execute(NOW)

    expect(updateSubscription).toHaveBeenCalledTimes(2)
    expect(updateSubscription).toHaveBeenLastCalledWith('2', {
      status: 'past_due',
    })
    expect(summary).toMatchObject({ pastDue: 1, failed: 1 })
  })

  it('pausa do Bitrix encerra a rodada', async () => {
    const updateSubscription = vi
      .fn()
      .mockRejectedValueOnce(
        new BitrixMethodPausedError('crm.item.update', 'portal', Date.now()),
      )
    const { useCase } = make([sub('1'), sub('2')], updateSubscription)

    const summary = await useCase.execute(NOW)

    expect(updateSubscription).toHaveBeenCalledTimes(1)
    expect(summary.paused).toBe(true)
  })

  it('erro na listagem que não é pausa sobe', async () => {
    const useCase = new ExpireSubscriptions(
      { listExpiring: vi.fn().mockRejectedValue(new Error('rede')) },
      { updateSubscription: vi.fn() },
      0,
    )

    await expect(useCase.execute(NOW)).rejects.toThrow('rede')
  })
})
