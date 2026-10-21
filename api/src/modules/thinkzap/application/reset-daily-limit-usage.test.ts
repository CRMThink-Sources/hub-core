import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { apiLogger } from '@/shared/infra/logger'
import { ResetDailyLimitUsage } from './reset-daily-limit-usage'

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
  metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1', zApiInstanceToken: 't' },
})

function makeSut(item: SubscriptionItem, subscriptionStatus = 'active') {
  const resetDay = vi.fn(() => Promise.resolve({ sent: 300, extra: 50 }))
  const sut = new ResetDailyLimitUsage(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme' },
        aplication: { id: 'app-1', spaId: '42' },
        subscriptions: [
          {
            id: 'sub-1',
            status: subscriptionStatus,
            currentPeriodEnd: new Date('2099-01-01'),
            items: [item],
          },
        ],
      }),
    } as never,
    { resetDay } as never,
  )
  const run = () =>
    sut.execute({
      subscriptionItemId: 'i1',
      domainId: 'domain-1',
      appCode: 'app',
      bitrixUserId: '7',
    })
  return { run, resetDay }
}

describe('ResetDailyLimitUsage', () => {
  it('Zerar com o limite atingido: contagem 0 e limite efetivo volta a 300', async () => {
    const { run, resetDay } = makeSut(zapi())

    const usage = await run()

    expect(resetDay).toHaveBeenCalledWith('Z-1', expect.any(Date))
    expect(usage).toMatchObject({
      sentToday: 0,
      extraToday: 0,
      effectiveLimit: 300,
      reached: false,
    })
    expect(apiLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        bitrixUserId: '7',
        sentBefore: 300,
        extraBefore: 50,
      }),
      expect.any(String),
    )
  })

  it('Zerar não muda a configuração: o limite continua ativado com 300', async () => {
    const { run } = makeSut(zapi())

    expect(await run()).toMatchObject({ enabled: true, limit: 300 })
  })

  it('funciona com o limite desligado (a contagem existe mesmo assim)', async () => {
    const { run, resetDay } = makeSut(zapi({ dailyLimitEnabled: false }))

    expect(await run()).toMatchObject({ enabled: false, sentToday: 0 })
    expect(resetDay).toHaveBeenCalled()
  })

  it('Linha oficial não zera', async () => {
    const { run, resetDay } = makeSut({
      ...zapi(),
      metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'CH-1' },
    })

    await expect(run()).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_invalid',
    })
    expect(resetDay).not.toHaveBeenCalled()
  })

  it('linha bloqueada recusa sem zerar', async () => {
    const { run, resetDay } = makeSut(zapi(), 'cancelled')

    await expect(run()).rejects.toBeInstanceOf(LineBlockedError)
    expect(resetDay).not.toHaveBeenCalled()
  })
})
