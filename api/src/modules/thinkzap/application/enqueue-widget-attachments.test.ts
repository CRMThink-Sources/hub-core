import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    logLevel: 'silent',
    nodeEnv: 'test',
    thinkzapUnifiedOutboxDomains: '*',
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnqueueWidgetAttachments } from './enqueue-widget-attachments'
import { SendWidgetMessageUseCase } from './send-widget-message.use-case'

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

function makeQueued() {
  let stored = 0
  const storage = {
    store: vi.fn(() => Promise.resolve({ key: `k-${++stored}` })),
    load: vi.fn(),
    remove: vi.fn(),
  }
  const outbox = {
    createParts: vi.fn((inputs: { clientMessageId: string }[]) =>
      Promise.resolve(
        inputs.map((input, i) => ({
          ...input,
          id: `row-${i}`,
          queueSeq: null,
        })),
      ),
    ),
    setQueueSeq: vi.fn(async () => {}),
  }
  const sendQueue = { enqueue: vi.fn(async () => {}) }
  let seq = 0
  const cadence = {
    enqueue: vi.fn((_line: string, _id: string) => Promise.resolve(++seq)),
  }
  const queued = new EnqueueWidgetAttachments({
    storage,
    outbox: outbox as never,
    sendQueue,
    cadence: cadence as never,
  })
  return { queued, storage, outbox, sendQueue, cadence }
}

function makeUseCase(wouldRefuse = false) {
  const q = makeQueued()
  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({ connected: true, token: 'tk' }),
    getPhoneData: vi.fn(),
    sendMessage: vi.fn(),
    sendImage: vi.fn(),
  }
  const useCase = new SendWidgetMessageUseCase(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme', memberId: 'm-1' },
        aplication: { id: 'installed-1', spaId: '42' },
        subscriptions: [
          {
            id: 'sub-1',
            status: 'active',
            currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
            items: [zapiItem()],
          },
        ],
      }),
    } as never,
    {
      getInstanceByInstanceId: vi
        .fn()
        .mockResolvedValue({ id: 'inst-db-1', instanceId: 'Z-1' }),
      create: vi.fn(),
    } as never,
    zApiClient as never,
    { execute: vi.fn() } as never,
    { create: vi.fn() } as never,
    { enqueue: vi.fn() } as never,
    undefined,
    { wouldRefuse: vi.fn().mockResolvedValue(wouldRefuse) } as never,
    null,
    q.queued,
  )
  return { ...q, useCase, zApiClient }
}

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  message: '  Segue o contrato  ',
  attachments: [
    {
      kind: 'file' as const,
      content: 'data:application/pdf;base64,cGRm',
      name: 'contrato.pdf',
    },
    {
      kind: 'image' as const,
      content: 'data:image/png;base64,iVBO',
      name: 'foto.png',
    },
  ],
  entity: 'deal',
  entityId: '42',
  operatorBitrixUserId: '7',
}

describe('Envio com anexo pelo widget via outbox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava texto e anexos na ordem, no mesmo grupo, e responde enfileirado', async () => {
    const sut = makeUseCase()

    const result = await sut.useCase.execute(input)

    expect(sut.zApiClient.sendMessage).not.toHaveBeenCalled()
    expect(sut.zApiClient.sendImage).not.toHaveBeenCalled()

    const parts = sut.outbox.createParts.mock.calls[0]![0] as Record<
      string,
      unknown
    >[]
    expect(parts.map(p => [p.partIndex, p.kind, p.mediaType ?? null])).toEqual([
      [0, 'TEXT', null],
      [1, 'MEDIA', 'document'],
      [2, 'MEDIA', 'image'],
    ])
    expect(new Set(parts.map(p => p.dispatchGroupId)).size).toBe(1)
    expect(parts.every(p => p.origin === 'WIDGET_ATTACHMENT')).toBe(true)
    expect(parts[0]).toMatchObject({
      text: 'Segue o contrato',
      operatorBitrixUserId: '7',
      dispatchMeta: {
        kind: 'widget-attachment',
        message: 'Segue o contrato',
        attachmentKinds: ['file', 'image'],
      },
    })
    // Sem legenda: o texto vai como parte própria, como no envio síncrono.
    expect(parts[1]!.caption).toBeUndefined()
    expect(parts[1]).toMatchObject({
      fileName: 'contrato.pdf',
      mediaSource: {
        kind: 'stored',
        key: 'k-1',
        contentType: 'application/pdf',
      },
    })

    expect(sut.storage.store).toHaveBeenCalledWith({
      data: Buffer.from('pdf'),
      contentType: 'application/pdf',
      scope: { domainId: 'domain-1' },
    })
    expect(sut.cadence.enqueue.mock.calls.map(c => c[1])).toEqual([
      'row-0',
      'row-1',
      'row-2',
    ])
    expect(sut.sendQueue.enqueue).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      status: 'queued',
      destination: '5511999999999',
      clientMessageIds: parts.map(p => p.clientMessageId),
    })
  })

  it('limite já atingido recusa o envio inteiro sem enfileirar nada', async () => {
    const sut = makeUseCase(true)

    await expect(sut.useCase.execute(input)).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_reached',
    })
    expect(sut.storage.store).not.toHaveBeenCalled()
    expect(sut.outbox.createParts).not.toHaveBeenCalled()
    expect(sut.sendQueue.enqueue).not.toHaveBeenCalled()
  })

  it('falha da guarda não deixa row para trás', async () => {
    const sut = makeUseCase()
    sut.storage.store.mockRejectedValueOnce(new Error('R2 fora'))

    await expect(sut.useCase.execute(input)).rejects.toThrow('R2 fora')
    expect(sut.outbox.createParts).not.toHaveBeenCalled()
  })
})
