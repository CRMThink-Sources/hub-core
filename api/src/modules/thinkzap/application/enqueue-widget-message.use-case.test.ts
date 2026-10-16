import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnqueueWidgetMessageUseCase } from './enqueue-widget-message.use-case'

const zapiItem = (): SubscriptionItem => ({
  id: 'i1',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: {
    ...DEFAULT_CONNECTOR_SETTINGS,
    dailyLimitEnabled: true,
    dailyLimit: 300,
  },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  message: 'Olá',
  entity: 'deal',
  entityId: '42',
}

function makeSut(wouldRefuse: boolean) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [
      {
        id: 'sub-1',
        status: 'active',
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        items: [zapiItem()],
      },
    ],
  })
  const instances = {
    getInstanceByInstanceId: vi
      .fn()
      .mockResolvedValue({ id: 'inst-db-1', instanceId: 'Z-1' }),
    create: vi.fn(),
  }
  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({ connected: true, token: 'tk' }),
  }
  const outbox = { create: vi.fn().mockResolvedValue({ id: 'outbox-1' }) }
  const sendQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }
  const quota = { wouldRefuse: vi.fn().mockResolvedValue(wouldRefuse) }

  const useCase = new EnqueueWidgetMessageUseCase(
    { execute } as never,
    instances as never,
    zApiClient as never,
    outbox as never,
    sendQueue,
    quota as never,
  )

  return { useCase, outbox, sendQueue, quota }
}

describe('EnqueueWidgetMessageUseCase limite diário', () => {
  beforeEach(() => vi.clearAllMocks())

  it('limite atingido: recusa na hora e nada é enfileirado', async () => {
    const sut = makeSut(true)

    await expect(sut.useCase.execute(input)).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_reached',
    })
    expect(sut.quota.wouldRefuse).toHaveBeenCalledWith(
      { lineKey: 'Z-1', enabled: true, limit: 300 },
      expect.any(Date),
    )
    expect(sut.outbox.create).not.toHaveBeenCalled()
    expect(sut.sendQueue.enqueue).not.toHaveBeenCalled()
  })

  it('abaixo do limite enfileira normalmente', async () => {
    const sut = makeSut(false)

    await sut.useCase.execute(input)

    expect(sut.sendQueue.enqueue).toHaveBeenCalledWith({ outboxId: 'outbox-1' })
  })
})
