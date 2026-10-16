import { describe, expect, it, vi } from 'vitest'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { ReleaseDailyLimitExtra } from './release-daily-limit-extra'

const zapi = (
  settings: Partial<SubscriptionItem['settings']> = {},
): SubscriptionItem => ({
  id: 'i1',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: {
    ...DEFAULT_CONNECTOR_SETTINGS,
    dailyLimitEnabled: true,
    dailyLimit: 300,
    ...settings,
  },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  },
})

const oficial = (): SubscriptionItem => ({
  ...zapi(),
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'CH-1' },
})

function makeSut(
  item: SubscriptionItem,
  options: { sent?: number; subscriptionStatus?: string } = {},
) {
  let extra = 0
  const addExtra = vi.fn((_channel: string, amount: number) => {
    extra += amount
    return Promise.resolve({ sent: options.sent ?? 0, extra })
  })
  const quota = { addExtra } as unknown as DailySendQuota

  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
      aplication: { id: 'installed-1', spaId: '42' },
      subscriptions: [
        {
          id: 'sub-1',
          status: options.subscriptionStatus ?? 'active',
          currentPeriodEnd: new Date('2099-01-01'),
          items: [item],
        },
      ],
    }),
  }

  const sut = new ReleaseDailyLimitExtra(getAplicationContext as never, quota)
  const run = (amount: number) =>
    sut.execute({
      subscriptionItemId: 'i1',
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      amount,
    })

  return { run, addExtra }
}

describe('ReleaseDailyLimitExtra', () => {
  it('libera extras após atingir o limite e devolve o novo efetivo', async () => {
    const { run, addExtra } = makeSut(zapi(), { sent: 300 })

    const usage = await run(100)

    expect(addExtra).toHaveBeenCalledWith('Z-1', 100, expect.any(Date))
    expect(usage).toMatchObject({
      sentToday: 300,
      extraToday: 100,
      effectiveLimit: 400,
      reached: false,
    })
  })

  it('liberações no mesmo dia somam', async () => {
    const { run } = makeSut(zapi())

    await run(50)
    const usage = await run(30)

    expect(usage.effectiveLimit).toBe(380)
  })

  it('recusa com o limite desligado e não grava nada', async () => {
    const { run, addExtra } = makeSut(zapi({ dailyLimitEnabled: false }))

    await expect(run(100)).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_disabled',
    })
    expect(addExtra).not.toHaveBeenCalled()
  })

  it('recusa linha oficial', async () => {
    const { run, addExtra } = makeSut(oficial())

    await expect(run(100)).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_invalid',
    })
    expect(addExtra).not.toHaveBeenCalled()
  })

  it('recusa quantidade inválida', async () => {
    const { run, addExtra } = makeSut(zapi())

    await expect(run(0)).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_invalid',
    })
    expect(addExtra).not.toHaveBeenCalled()
  })

  it('recusa linha bloqueada', async () => {
    const { run, addExtra } = makeSut(zapi(), {
      subscriptionStatus: 'cancelled',
    })

    await expect(run(100)).rejects.toBeInstanceOf(LineBlockedError)
    expect(addExtra).not.toHaveBeenCalled()
  })
})
