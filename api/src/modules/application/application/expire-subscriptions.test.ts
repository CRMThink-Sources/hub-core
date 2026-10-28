import { describe, expect, it, vi } from 'vitest'
import type { SubscriptionLineBilling } from '@/modules/application/domain/repositories/subscription-line-billing'
import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { ExpireSubscriptions } from './expire-subscriptions'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const NOW = new Date('2026-11-08T12:00:00Z')
const YESTERDAY_END = new Date('2026-11-07T23:59:59.999Z')
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const sub = (
  id: string,
  overrides: Partial<ExpirableSubscription> = {},
): ExpirableSubscription => ({
  id,
  status: 'active',
  modality: 'manual',
  currentPeriodEnd: YESTERDAY_END,
  pastDueAt: null,
  ...overrides,
})

const paused = () =>
  new BitrixMethodPausedError('crm.item.update', 'portal.bitrix24.com.br', 1000)

const make = (
  lists: {
    expiring?: ExpirableSubscription[]
    pastDue?: ExpirableSubscription[]
    dated?: ExpirableSubscription[]
    activeIds?: string[]
  } = {},
  options: {
    updateSubscription?: ReturnType<typeof vi.fn>
    graceDays?: number
    lineBilling?: SubscriptionLineBilling | null
  } = {},
) => {
  const updateSubscription =
    options.updateSubscription ?? vi.fn().mockResolvedValue({})
  const lister = {
    listExpiring: vi.fn().mockResolvedValue(lists.expiring ?? []),
    listPastDue: vi.fn().mockResolvedValue(lists.pastDue ?? []),
    listWithPastDueAt: vi.fn().mockResolvedValue(lists.dated ?? []),
    listActiveIds: vi.fn().mockResolvedValue(lists.activeIds ?? []),
  }
  return {
    useCase: new ExpireSubscriptions(
      lister,
      { updateSubscription: updateSubscription as never },
      options.graceDays ?? 0,
      options.lineBilling === undefined ? null : options.lineBilling,
    ),
    updateSubscription,
    lister,
  }
}

const makeLineBilling = (
  overrides: Partial<SubscriptionLineBilling> = {},
): SubscriptionLineBilling & {
  unsubscribeLinesForPastDue: ReturnType<typeof vi.fn>
  reconcileActiveLines: ReturnType<typeof vi.fn>
} =>
  ({
    unsubscribeLinesForPastDue: vi.fn().mockResolvedValue([]),
    reconcileActiveLines: vi
      .fn()
      .mockResolvedValue({ checked: 0, results: [] }),
    ...overrides,
  }) as never

describe('ExpireSubscriptions — etapa 1: expirar', () => {
  it('grava trial_expired no trial e past_due + "Vencido em" na manual, numa escrita', async () => {
    const { useCase, updateSubscription } = make({
      expiring: [sub('1', { status: 'trialing' }), sub('2')],
    })

    const summary = await useCase.execute(NOW)

    expect(updateSubscription.mock.calls).toEqual([
      ['1', { status: 'trial_expired' }],
      ['2', { status: 'past_due', pastDueAt: NOW }],
    ])
    expect(summary).toMatchObject({
      checked: 2,
      trialExpired: 1,
      pastDue: 1,
      failed: 0,
      paused: false,
    })
    expect(summary.changes).toEqual([
      {
        kind: 'status',
        subscriptionId: '1',
        from: 'trialing',
        to: 'trial_expired',
        periodEnd: YESTERDAY_END,
        succeeded: true,
      },
      {
        kind: 'status',
        subscriptionId: '2',
        from: 'active',
        to: 'past_due',
        periodEnd: YESTERDAY_END,
        succeeded: true,
      },
    ])
  })

  it('não grava stripe, assinatura no último dia nem manual dentro da carência', async () => {
    const { useCase, updateSubscription } = make(
      {
        expiring: [
          sub('1', { modality: 'stripe' }),
          sub('2', { currentPeriodEnd: new Date('2026-11-08T23:59:59.999Z') }),
          sub('3'),
        ],
      },
      { graceDays: 3 },
    )

    const summary = await useCase.execute(NOW)

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(summary.checked).toBe(3)
    expect(summary.changes).toEqual([])
  })

  it('falha em uma não impede a seguinte', async () => {
    const updateSubscription = vi
      .fn()
      .mockRejectedValueOnce(new Error('bitrix fora'))
      .mockResolvedValueOnce({})
    const { useCase } = make(
      { expiring: [sub('1'), sub('2')] },
      { updateSubscription },
    )

    const summary = await useCase.execute(NOW)

    expect(summary).toMatchObject({ pastDue: 1, failed: 1 })
    expect(summary.changes[0]).toMatchObject({
      subscriptionId: '1',
      succeeded: false,
      error: 'bitrix fora',
    })
  })

  it('erro na listagem que não é pausa sobe', async () => {
    const { useCase, lister } = make()
    lister.listExpiring.mockRejectedValue(new Error('bitrix fora'))

    await expect(useCase.execute(NOW)).rejects.toThrow('bitrix fora')
  })
})

describe('ExpireSubscriptions — etapas 2 e 3: vencidas', () => {
  it('data a vencida sem data e limpa a data de quem saiu de Vencido, sem registro', async () => {
    const { useCase, updateSubscription } = make({
      pastDue: [sub('10', { status: 'past_due' })],
      dated: [
        sub('11', { status: 'active', pastDueAt: day('2026-10-01') }),
        sub('12', { status: 'past_due', pastDueAt: day('2026-11-07') }),
      ],
    })

    const summary = await useCase.execute(NOW)

    expect(updateSubscription.mock.calls).toEqual([
      ['10', { pastDueAt: NOW }],
      ['11', { pastDueAt: null }],
    ])
    expect(summary.changes).toEqual([])
    expect(summary.failed).toBe(0)
  })

  it('quinto dia desassina as linhas; falha numa linha conta e registra', async () => {
    const lineBilling = makeLineBilling({
      unsubscribeLinesForPastDue: vi.fn().mockResolvedValue([
        {
          itemId: '9001',
          subscriptionId: '20',
          provider: 'ZAPI',
          action: 'unsubscribed',
          succeeded: false,
          error: 'z-api fora',
        },
        {
          itemId: '9002',
          subscriptionId: '20',
          provider: 'HUBMESSAGE',
          action: 'unsubscribed',
          succeeded: true,
        },
      ]),
    })
    const { useCase, updateSubscription } = make(
      {
        pastDue: [
          sub('20', { status: 'past_due', pastDueAt: day('2026-11-03') }),
        ],
      },
      { lineBilling },
    )

    const summary = await useCase.execute(NOW)

    expect(lineBilling.unsubscribeLinesForPastDue).toHaveBeenCalledWith('20')
    expect(updateSubscription).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ linesUnsubscribed: 1, failed: 1 })
    expect(summary.changes).toEqual([
      {
        kind: 'line-unsubscribed',
        subscriptionId: '20',
        itemId: '9001',
        provider: 'ZAPI',
        from: null,
        to: null,
        periodEnd: YESTERDAY_END,
        succeeded: false,
        error: 'z-api fora',
      },
      expect.objectContaining({
        kind: 'line-unsubscribed',
        itemId: '9002',
        provider: 'HUBMESSAGE',
        succeeded: true,
      }),
    ])
  })

  it('quarto dia não chama o provider', async () => {
    const lineBilling = makeLineBilling()
    const { useCase } = make(
      {
        pastDue: [
          sub('20', { status: 'past_due', pastDueAt: day('2026-11-04') }),
        ],
      },
      { lineBilling },
    )

    await useCase.execute(NOW)

    expect(lineBilling.unsubscribeLinesForPastDue).not.toHaveBeenCalled()
  })

  it('décimo dia grava Cancelado com a data, sem chamar o provider', async () => {
    const lineBilling = makeLineBilling()
    const { useCase, updateSubscription } = make(
      {
        pastDue: [
          sub('30', { status: 'past_due', pastDueAt: day('2026-10-29') }),
        ],
      },
      { lineBilling },
    )

    const summary = await useCase.execute(NOW)

    expect(updateSubscription).toHaveBeenCalledWith('30', {
      status: 'cancelled',
      canceledAt: NOW,
    })
    expect(lineBilling.unsubscribeLinesForPastDue).not.toHaveBeenCalled()
    expect(summary.cancelled).toBe(1)
    expect(summary.changes).toEqual([
      expect.objectContaining({
        kind: 'status',
        subscriptionId: '30',
        from: 'past_due',
        to: 'cancelled',
        succeeded: true,
      }),
    ])
  })

  it('pausa do Bitrix no meio da desassinatura encerra a rodada', async () => {
    const lineBilling = makeLineBilling({
      unsubscribeLinesForPastDue: vi.fn().mockRejectedValue(paused()),
    })
    const { useCase, lister } = make(
      {
        pastDue: [
          sub('20', { status: 'past_due', pastDueAt: day('2026-11-03') }),
        ],
      },
      { lineBilling },
    )

    const summary = await useCase.execute(NOW, { reconcile: true })

    expect(summary.paused).toBe(true)
    expect(lister.listWithPastDueAt).not.toHaveBeenCalled()
    expect(lineBilling.reconcileActiveLines).not.toHaveBeenCalled()
  })
})

describe('ExpireSubscriptions — etapa 4: reconciliação', () => {
  it('só roda quando pedida, e registra as linhas assinadas agora', async () => {
    const lineBilling = makeLineBilling({
      reconcileActiveLines: vi.fn().mockResolvedValue({
        checked: 40,
        results: [
          {
            itemId: '9003',
            subscriptionId: '777',
            provider: 'ZAPI',
            action: 'subscribed',
            succeeded: true,
          },
        ],
      }),
    })
    const { useCase } = make({ activeIds: ['777'] }, { lineBilling })

    const withoutReconcile = await useCase.execute(NOW)
    expect(lineBilling.reconcileActiveLines).not.toHaveBeenCalled()
    expect(withoutReconcile.reconciliation).toBe(false)

    const summary = await useCase.execute(NOW, { reconcile: true })

    expect(lineBilling.reconcileActiveLines).toHaveBeenCalledWith(['777'])
    expect(summary).toMatchObject({
      reconciliation: true,
      linesChecked: 40,
      linesSubscribed: 1,
    })
    expect(summary.changes).toEqual([
      {
        kind: 'line-subscribed',
        subscriptionId: '777',
        itemId: '9003',
        provider: 'ZAPI',
        from: null,
        to: null,
        periodEnd: null,
        succeeded: true,
      },
    ])
  })
})

describe('ExpireSubscriptions — provider desligado no ambiente', () => {
  it('grava status e datas, mas não desassina nem reconcilia, e diz que pulou', async () => {
    const { useCase, updateSubscription, lister } = make({
      pastDue: [
        sub('20', { status: 'past_due', pastDueAt: day('2026-11-02') }),
        sub('30', { status: 'past_due', pastDueAt: day('2026-10-29') }),
      ],
      activeIds: ['777'],
    })

    const summary = await useCase.execute(NOW, { reconcile: true })

    expect(updateSubscription).toHaveBeenCalledWith('30', {
      status: 'cancelled',
      canceledAt: NOW,
    })
    expect(lister.listActiveIds).not.toHaveBeenCalled()
    expect(summary).toMatchObject({
      providerStepsSkipped: true,
      reconciliation: false,
      linesUnsubscribed: 0,
      cancelled: 1,
    })
  })
})
