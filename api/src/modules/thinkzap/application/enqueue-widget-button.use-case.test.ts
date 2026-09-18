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
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { TooManyButtonsError } from '@/modules/thinkzap/domain/ports/button-errors'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnqueueWidgetButtonUseCase } from './enqueue-widget-button.use-case'
import type { SendWidgetButtonInput } from './send-widget-button.types'

const hubItem = (
  overrides: Partial<SubscriptionItem> = {},
): SubscriptionItem => ({
  id: 'i1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '10',
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
  ...overrides,
})

const zapiItem = (): SubscriptionItem =>
  hubItem({
    id: 'i_zapi',
    metadata: {
      provider: 'ZAPI',
      zApiInstanceId: 'Z-1',
      zApiInstanceToken: 'TOKEN-SECRETO',
    },
  })

const baseInput = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  body: 'Como podemos ajudar?',
  buttons: [
    { id: '1', label: 'Site', type: 'URL' as const, url: 'https://x.io' },
  ],
  entity: 'deal',
  entityId: '42',
}

const createdRow = { id: 'outbox-1' }

function makeSut(
  options: {
    items?: SubscriptionItem[]
    subscriptionStatus?: string
    currentPeriodEnd?: Date
    zApiConnected?: boolean
  } = {},
) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [
      {
        id: 'sub-1',
        status: options.subscriptionStatus ?? 'active',
        currentPeriodEnd:
          options.currentPeriodEnd ?? new Date('2099-01-01T00:00:00.000Z'),
        items: options.items ?? [hubItem()],
      },
    ],
  })

  const getInstanceByChannelId = vi
    .fn()
    .mockResolvedValue({ id: 'inst-db-1', instanceId: 'C-9' })
  const getInstanceByInstanceId = vi
    .fn()
    .mockResolvedValue({ id: 'inst-db-zapi', instanceId: 'Z-1' })
  const create = vi.fn().mockResolvedValue({ id: 'inst-nova' })

  const zApiClient = {
    getInstance: vi
      .fn()
      .mockResolvedValue({ connected: options.zApiConnected ?? true }),
  }

  const outbox = { create: vi.fn().mockResolvedValue(createdRow) }
  const sendQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

  const useCase = new EnqueueWidgetButtonUseCase(
    { execute } as never,
    { getInstanceByChannelId, getInstanceByInstanceId, create } as never,
    zApiClient as never,
    outbox as never,
    sendQueue,
  )

  return {
    execute,
    getInstanceByChannelId,
    getInstanceByInstanceId,
    create,
    zApiClient,
    outbox,
    sendQueue,
    enqueueButton: (overrides: Partial<SendWidgetButtonInput> = {}) =>
      useCase.execute({ ...baseInput, ...overrides }),
  }
}

const outboxCall = (sut: {
  outbox: { create: ReturnType<typeof vi.fn> }
}): Record<string, unknown> =>
  sut.outbox.create.mock.calls[0]?.[0] as Record<string, unknown>

describe('EnqueueWidgetButtonUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava a intenção como INTERACTIVE_BUTTON para linha HUBMESSAGE', async () => {
    const sut = makeSut()

    await sut.enqueueButton()

    expect(outboxCall(sut)).toMatchObject({
      kind: 'INTERACTIVE_BUTTON',
      instanceId: 'inst-db-1',
      subscriptionItemId: 'i1',
      destination: '5511999999999',
      text: 'Como podemos ajudar?',
      entity: 'deal',
      entityId: '42',
    })
  })

  it('grava a intenção para linha ZAPI', async () => {
    const sut = makeSut({ items: [zapiItem()] })

    await sut.enqueueButton({ subscriptionItemId: 'i_zapi' })

    expect(outboxCall(sut)).toMatchObject({
      kind: 'INTERACTIVE_BUTTON',
      instanceId: 'inst-db-zapi',
    })
  })

  it('responde queued sem id do provider', async () => {
    const sut = makeSut()

    const result = await sut.enqueueButton()

    expect(result.status).toBe('queued')
    expect(result.destination).toBe('5511999999999')
    expect(result.clientMessageId).toEqual(expect.any(String))
  })

  it('enfileira o job pelo id da row, depois de gravá-la', async () => {
    const sut = makeSut()

    await sut.enqueueButton()

    expect(sut.sendQueue.enqueue).toHaveBeenCalledWith({ outboxId: 'outbox-1' })
    expect(Number(sut.outbox.create.mock.invocationCallOrder[0])).toBeLessThan(
      Number(sut.sendQueue.enqueue.mock.invocationCallOrder[0]),
    )
  })

  it('escopa a resolução pelo par (domainId, appCode) do token', async () => {
    const sut = makeSut()

    await sut.enqueueButton()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  describe('recusas síncronas', () => {
    it('recusa linha bloqueada sem gravar nem enfileirar', async () => {
      const sut = makeSut({
        subscriptionStatus: 'past_due',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      })

      await expect(sut.enqueueButton()).rejects.toBeInstanceOf(LineBlockedError)
      expect(sut.outbox.create).not.toHaveBeenCalled()
      expect(sut.sendQueue.enqueue).not.toHaveBeenCalled()
    })

    it('erro quando a linha não está na instalação do token', async () => {
      const sut = makeSut()

      await expect(
        sut.enqueueButton({ subscriptionItemId: 'de-outro' }),
      ).rejects.toBeInstanceOf(LineNotFoundError)
    })

    it('recusa destino inválido antes de gravar', async () => {
      const sut = makeSut()

      await expect(sut.enqueueButton({ destination: 'abc' })).rejects.toThrow(
        'Invalid destination phone number',
      )
      expect(sut.outbox.create).not.toHaveBeenCalled()
    })

    it('aceita botão REPLY numa linha HUBMESSAGE — quick reply, até 3', async () => {
      const sut = makeSut()

      await sut.enqueueButton({
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      })

      expect(sut.outbox.create).toHaveBeenCalled()
    })

    it('recusa o 4º botão REPLY numa linha HUBMESSAGE, sem gravar', async () => {
      const sut = makeSut()

      await expect(
        sut.enqueueButton({
          buttons: [
            { id: '1', label: 'A', type: 'REPLY' },
            { id: '2', label: 'B', type: 'REPLY' },
            { id: '3', label: 'C', type: 'REPLY' },
            { id: '4', label: 'D', type: 'REPLY' },
          ],
        }),
      ).rejects.toBeInstanceOf(TooManyButtonsError)
      expect(sut.outbox.create).not.toHaveBeenCalled()
    })
  })
})
