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

describe('EnqueueWidgetMessageUseCase fila FIFO da linha', () => {
  beforeEach(() => vi.clearAllMocks())

  function withCadence() {
    const base = makeSut(false)
    let seq = 0
    const cadence = { enqueue: vi.fn(() => Promise.resolve(++seq)) }
    const outbox = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: 'outbox-1', queueSeq: null })
        .mockResolvedValueOnce({ id: 'outbox-2', queueSeq: null }),
      setQueueSeq: vi.fn().mockResolvedValue(undefined),
    }
    const useCase = new EnqueueWidgetMessageUseCase(
      (base.useCase as unknown as { getAplicationContext: never })
        .getAplicationContext,
      (base.useCase as unknown as { instances: never }).instances,
      (base.useCase as unknown as { zApiClient: never }).zApiClient,
      outbox as never,
      base.sendQueue,
      base.quota as never,
      cadence as never,
    )
    return { useCase, cadence, outbox, sendQueue: base.sendQueue }
  }

  it('a sequência cresce por linha, na ordem de chegada, antes do job', async () => {
    const sut = withCadence()

    await sut.useCase.execute(input)
    await sut.useCase.execute(input)

    expect(sut.cadence.enqueue.mock.calls).toEqual([
      ['Z-1', 'outbox-1'],
      ['Z-1', 'outbox-2'],
    ])
    expect(sut.outbox.setQueueSeq.mock.calls).toEqual([
      ['outbox-1', 1],
      ['outbox-2', 2],
    ])
    expect(sut.cadence.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      sut.sendQueue.enqueue.mock.invocationCallOrder[0]!,
    )
  })

  it('marca a origem: widget ou campanha de SMS', async () => {
    const sut = withCadence()

    await sut.useCase.execute(input)
    await sut.useCase.execute({
      ...input,
      smsMessageId: 'm-1',
      smsSenderCode: 's',
    })

    expect(
      sut.outbox.create.mock.calls.map(
        ([arg]) => (arg as { origin: string }).origin,
      ),
    ).toEqual(['WIDGET', 'SMS_CAMPAIGN'])
  })

  it('falha do Redis não recusa o envio', async () => {
    const sut = withCadence()
    sut.cadence.enqueue.mockRejectedValueOnce(new Error('redis fora'))

    await expect(sut.useCase.execute(input)).resolves.toMatchObject({
      status: 'queued',
    })
    expect(sut.sendQueue.enqueue).toHaveBeenCalled()
  })
})
