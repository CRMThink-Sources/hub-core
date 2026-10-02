import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import {
  ButtonChannelNotConnectedError,
  InvalidButtonCombinationError,
  TooManyButtonsError,
} from '@/modules/thinkzap/domain/ports/button-errors'
import type { CreateWidgetOutboxInput } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { EnqueueInteractiveButtonSendService } from './enqueue-interactive-button-send.service'

const zapiItem = (
  overrides: Partial<SubscriptionItem> = {},
): SubscriptionItem => ({
  id: 'item-1',
  name: 'Linha item-1',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-1',
  },
  ...overrides,
})

const hubItem = (
  overrides: Partial<SubscriptionItem> = {},
): SubscriptionItem => ({
  id: 'item-1',
  name: 'Linha item-1',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-1',
    wabaId: 'W-1',
  },
  ...overrides,
})

function makeContext(item: SubscriptionItem, subscriptionStatus = 'active') {
  return {
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [
      {
        id: 'sub-1',
        status: subscriptionStatus,
        currentPeriodEnd: new Date('2099-01-01'),
        items: [item],
      },
    ],
  }
}

function makeSut(item: SubscriptionItem, subscriptionStatus = 'active') {
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue(makeContext(item, subscriptionStatus)),
  }
  const instances = {
    getInstanceByInstanceId: vi.fn().mockResolvedValue(null),
    getInstanceByChannelId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'instance-1' }),
  }
  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({ connected: true }),
  }
  const outbox = {
    create: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
  }
  const sendQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

  const service = new EnqueueInteractiveButtonSendService(
    getAplicationContext as never,
    instances as never,
    zApiClient as never,
    outbox as never,
    sendQueue as never,
  )

  return {
    service,
    getAplicationContext,
    instances,
    zApiClient,
    outbox,
    sendQueue,
  }
}

const baseInput = {
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

describe('EnqueueInteractiveButtonSendService.resolveTarget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolve linha ZAPI habilitada e conectada', async () => {
    const { service } = makeSut(zapiItem())

    const target = await service.resolveTarget(baseInput)

    expect(target.provider).toBe(ConnectorProvider.ZAPI)
    expect(target.instance.id).toBe('instance-1')
  })

  it('resolve linha HUBMESSAGE habilitada e com wabaId', async () => {
    const { service } = makeSut(hubItem())

    const target = await service.resolveTarget(baseInput)

    expect(target.provider).toBe(ConnectorProvider.HUBMESSAGE)
  })

  it('recusa linha HUBMESSAGE sem wabaId', async () => {
    const { service } = makeSut(
      hubItem({
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'C-1',
          wabaId: undefined,
        },
      }),
    )

    await expect(service.resolveTarget(baseInput)).rejects.toBeInstanceOf(
      ButtonChannelNotConnectedError,
    )
  })

  it('recusa linha ZAPI desconectada', async () => {
    const { service, zApiClient } = makeSut(zapiItem())
    zApiClient.getInstance.mockResolvedValue({ connected: false })

    await expect(service.resolveTarget(baseInput)).rejects.toThrow()
  })

  it('não recusa linha ZAPI quando a leitura de status falha', async () => {
    const { service, zApiClient } = makeSut(zapiItem())
    zApiClient.getInstance.mockRejectedValue(new Error('z-api fora'))

    await expect(service.resolveTarget(baseInput)).resolves.toBeDefined()
  })

  it('recusa linha bloqueada (assinatura cancelada)', async () => {
    const { service } = makeSut(zapiItem(), 'cancelled')

    await expect(service.resolveTarget(baseInput)).rejects.toBeInstanceOf(
      LineBlockedError,
    )
  })
})

describe('EnqueueInteractiveButtonSendService.enqueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava a intenção e enfileira para linha ZAPI', async () => {
    const { service, outbox, sendQueue } = makeSut(zapiItem())
    const target = await service.resolveTarget(baseInput)

    const result = await service.enqueue(target, {
      ...baseInput,
      destination: '11999999999',
      body: 'uma mensagem',
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      entity: 'deal',
      entityId: '42',
    })

    expect(result.status).toBe('queued')
    expect(outbox.create).toHaveBeenCalledTimes(1)
    const created = outbox.create.mock.calls[0]?.[0] as
      | CreateWidgetOutboxInput
      | undefined
    expect(created?.kind).toBe('INTERACTIVE_BUTTON')
    expect(created?.text).toBe('uma mensagem')
    expect(created?.buttonPayload?.body).toBe('uma mensagem')
    expect(created?.buttonPayload?.buttons).toEqual([
      { id: '1', label: 'Sim', type: 'REPLY' },
    ])
    expect(sendQueue.enqueue).toHaveBeenCalledWith({ outboxId: 'outbox-1' })
  })

  it('aceita REPLY para provider HUBMESSAGE — quick reply, até 3 botões', async () => {
    const { service, outbox } = makeSut(hubItem())
    const target = await service.resolveTarget(baseInput)

    await service.enqueue(target, {
      ...baseInput,
      destination: '11999999999',
      body: 'uma mensagem',
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      entity: 'deal',
      entityId: '42',
    })

    expect(outbox.create).toHaveBeenCalled()
  })

  it('recusa o 4º botão REPLY para provider HUBMESSAGE antes de gravar a intenção', async () => {
    const { service, outbox } = makeSut(hubItem())
    const target = await service.resolveTarget(baseInput)

    await expect(
      service.enqueue(target, {
        ...baseInput,
        destination: '11999999999',
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'A', type: 'REPLY' },
          { id: '2', label: 'B', type: 'REPLY' },
          { id: '3', label: 'C', type: 'REPLY' },
          { id: '4', label: 'D', type: 'REPLY' },
        ],
        entity: 'deal',
        entityId: '42',
      }),
    ).rejects.toBeInstanceOf(TooManyButtonsError)

    expect(outbox.create).not.toHaveBeenCalled()
  })

  it('recusa o 6º botão para provider ZAPI antes de gravar a intenção — teto geral de 5', async () => {
    const { service, outbox } = makeSut(zapiItem())
    const target = await service.resolveTarget(baseInput)

    await expect(
      service.enqueue(target, {
        ...baseInput,
        destination: '11999999999',
        body: 'uma mensagem',
        buttons: ['A', 'B', 'C', 'D', 'E', 'F'].map((label, index) => ({
          id: String(index + 1),
          label,
          type: 'REPLY' as const,
        })),
        entity: 'deal',
        entityId: '42',
      }),
    ).rejects.toBeInstanceOf(TooManyButtonsError)

    expect(outbox.create).not.toHaveBeenCalled()
  })

  it('recusa mistura de REPLY com URL para provider ZAPI antes de gravar a intenção', async () => {
    const { service, outbox } = makeSut(zapiItem())
    const target = await service.resolveTarget(baseInput)

    await expect(
      service.enqueue(target, {
        ...baseInput,
        destination: '11999999999',
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Sim', type: 'REPLY' },
          { id: '2', label: 'Site', type: 'URL', url: 'https://x.io' },
        ],
        entity: 'deal',
        entityId: '42',
      }),
    ).rejects.toBeInstanceOf(InvalidButtonCombinationError)

    expect(outbox.create).not.toHaveBeenCalled()
  })

  it('recusa destino inválido antes de gravar a intenção', async () => {
    const { service, outbox } = makeSut(zapiItem())
    const target = await service.resolveTarget(baseInput)

    await expect(
      service.enqueue(target, {
        ...baseInput,
        destination: 'abc',
        body: 'uma mensagem',
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
        entity: 'deal',
        entityId: '42',
      }),
    ).rejects.toThrow('Invalid destination phone number')

    expect(outbox.create).not.toHaveBeenCalled()
  })
})
