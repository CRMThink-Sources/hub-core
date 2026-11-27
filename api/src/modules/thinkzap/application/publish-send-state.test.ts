import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: warnMock, error: vi.fn(), debug: vi.fn() },
}))

import type { SendNoticeRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  publishSendState,
  type PublishSendStateDeps,
} from './publish-send-state'

const row = (
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'instance-1',
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'app-1',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'DEAL',
  entityId: '42',
  kind: 'TEXT',
  templateName: null,
  templateLanguage: null,
  templateParameters: null,
  templateButtonParameters: null,
  templateHeaderImageUrl: null,
  buttonPayload: null,
  status: 'SENT',
  providerMessageId: 'provider-1',
  timelineNotifiedAt: null,
  attempts: 1,
  lastError: null,
  operatorBitrixUserId: '7',
  smsSenderCode: null,
  smsMessageId: null,
  origin: 'WIDGET',
  mediaType: null,
  mediaSource: null,
  fileName: null,
  caption: null,
  dispatchGroupId: null,
  partIndex: null,
  dispatchMeta: null,
  bitrixMessageId: null,
  bitrixChatId: null,
  originContext: null,
  sendNoticeId: null,
  deliveredAt: null,
  readAt: null,
  rejectedAt: null,
  failureCode: null,
  failureReason: null,
  queueSeq: null,
  cadenceWaitUntil: null,
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  sentAt: null,
  ...overrides,
})

const notice: SendNoticeRecord = {
  id: 'notice-1',
  dispatchKey: 'outbox-1',
  domainId: 'domain-1',
  appCode: 'app-1',
  entity: 'DEAL',
  entityId: '42',
  operatorBitrixUserId: '7',
  eager: false,
  commentId: null,
  commentAsAuthor: false,
  commentClaimedAt: null,
  fromPhone: null,
  alertedFailures: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

function makeDeps(record: WidgetOutboxRecord | null) {
  const findById = vi
    .fn<PublishSendStateDeps['outbox']['findById']>()
    .mockResolvedValue(record)
  const linkSendNotice = vi
    .fn<PublishSendStateDeps['outbox']['linkSendNotice']>()
    .mockResolvedValue(undefined)
  const ensure = vi
    .fn<PublishSendStateDeps['notices']['ensure']>()
    .mockResolvedValue(notice)
  const enqueue = vi
    .fn<PublishSendStateDeps['enqueue']>()
    .mockResolvedValue(undefined)

  return {
    findById,
    linkSendNotice,
    ensure,
    enqueue,
    deps: {
      outbox: { findById, linkSendNotice },
      notices: { ensure },
      enqueue,
    } satisfies PublishSendStateDeps,
  }
}

describe('publishSendState', () => {
  beforeEach(() => {
    warnMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('garante o aviso do disparo, liga a row e agenda só o comentário em SENT', async () => {
    const { deps, findById, ensure, linkSendNotice, enqueue } = makeDeps(row())

    await publishSendState('outbox-1', deps)

    expect(findById).toHaveBeenCalledWith('outbox-1')
    expect(ensure).toHaveBeenCalledWith({
      dispatchKey: 'outbox-1',
      domainId: 'domain-1',
      appCode: 'app-1',
      entity: 'DEAL',
      entityId: '42',
      operatorBitrixUserId: '7',
    })
    expect(linkSendNotice).toHaveBeenCalledWith(
      { rowId: 'outbox-1', dispatchGroupId: null },
      'notice-1',
    )
    expect(enqueue.mock.calls).toEqual([
      [{ kind: 'comment', noticeId: 'notice-1' }],
    ])
  })

  it('usa o grupo como identidade do disparo', async () => {
    const { deps, ensure, linkSendNotice } = makeDeps(
      row({ dispatchGroupId: 'group-1' }),
    )

    await publishSendState('outbox-1', deps)

    expect(ensure).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchKey: 'group-1' }),
    )
    expect(linkSendNotice).toHaveBeenCalledWith(
      { rowId: 'outbox-1', dispatchGroupId: 'group-1' },
      'notice-1',
    )
  })

  it('reaproveita o aviso que a row já tem', async () => {
    const { deps, ensure, linkSendNotice, enqueue } = makeDeps(
      row({ sendNoticeId: 'notice-9' }),
    )

    await publishSendState('outbox-1', deps)

    expect(ensure).not.toHaveBeenCalled()
    expect(linkSendNotice).not.toHaveBeenCalled()
    expect(enqueue.mock.calls).toEqual([
      [{ kind: 'comment', noticeId: 'notice-9' }],
    ])
  })

  it.each([
    ['FAILED', { status: 'FAILED' as const }],
    ['UNKNOWN', { status: 'UNKNOWN' as const }],
    ['recusada depois do aceite', { rejectedAt: new Date(0) }],
  ])('agenda comentário e alerta na row %s', async (_label, overrides) => {
    const { deps, enqueue } = makeDeps(row(overrides))

    await publishSendState('outbox-1', deps)

    expect(enqueue.mock.calls).toEqual([
      [{ kind: 'comment', noticeId: 'notice-1' }],
      [{ kind: 'alert', noticeId: 'notice-1' }],
    ])
  })

  it.each([
    ['campanha de SMS', row({ smsMessageId: 'msg-1', status: 'FAILED' })],
    ['origem não acompanhada', row({ origin: 'OPERATOR' })],
    ['row inexistente', null],
  ])('não faz nada em %s', async (_label, record) => {
    const { deps, ensure, linkSendNotice, enqueue } = makeDeps(record)

    await publishSendState('outbox-1', deps)

    expect(ensure).not.toHaveBeenCalled()
    expect(linkSendNotice).not.toHaveBeenCalled()
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('resolve e registra quando o enqueue rejeita', async () => {
    const { deps, enqueue } = makeDeps(row())
    enqueue.mockRejectedValue(new Error('Redis fora'))

    await expect(publishSendState('outbox-1', deps)).resolves.toBeUndefined()

    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'thinkzap.message.widget_send_notice_failed',
        outboxId: 'outbox-1',
      }),
      expect.any(String),
    )
  })

  it('resolve e registra quando o banco falha', async () => {
    const { deps, findById, enqueue } = makeDeps(row())
    findById.mockRejectedValue(new Error('banco fora'))

    await expect(publishSendState('outbox-1', deps)).resolves.toBeUndefined()

    expect(enqueue).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalledTimes(1)
  })

  /** Com o Redis fora, o `add` do BullMQ não rejeita: fica pendurado. */
  it('desiste do enqueue que nunca responde, sem prender o job de envio', async () => {
    vi.useFakeTimers()
    const { deps, enqueue } = makeDeps(row({ status: 'FAILED' }))
    enqueue.mockReturnValue(new Promise<void>(() => {}))
    const settled = vi.fn()

    void publishSendState('outbox-1', deps).then(settled)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(settled).toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledTimes(2)
    expect(warnMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Um insert ou update preso em lock do InnoDB também não pode segurar o envio. */
  it.each(['findById', 'linkSendNotice'] as const)(
    'desiste em 5 s quando %s nunca responde',
    async method => {
      vi.useFakeTimers()
      const mocks = makeDeps(row())
      mocks[method].mockReturnValue(new Promise<never>(() => {}))
      const settled = vi.fn()

      void publishSendState('outbox-1', mocks.deps).then(settled)
      await vi.advanceTimersByTimeAsync(4_999)
      expect(settled).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)

      expect(settled).toHaveBeenCalled()
      expect(mocks.enqueue).not.toHaveBeenCalled()
      expect(warnMock).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  /** O prazo é um só para o corpo inteiro, não um por chamada. */
  it('soma o tempo do banco e o da fila no mesmo prazo', async () => {
    vi.useFakeTimers()
    const { deps, findById, enqueue } = makeDeps(row())
    findById.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(row()), 3_000)),
    )
    enqueue.mockReturnValue(new Promise<void>(() => {}))
    const settled = vi.fn()

    void publishSendState('outbox-1', deps).then(settled)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(settled).toHaveBeenCalled()
  })

  /** O trabalho abandonado pode falhar depois; isso não vira rejeição solta. */
  it('absorve a falha que chega depois do prazo', async () => {
    vi.useFakeTimers()
    const { deps, linkSendNotice } = makeDeps(row())
    linkSendNotice.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('lock wait timeout')), 50_000),
        ),
    )

    const result = publishSendState('outbox-1', deps)
    await vi.advanceTimersByTimeAsync(50_000)

    await expect(result).resolves.toBeUndefined()
    expect(warnMock).toHaveBeenCalledTimes(1)
  })
})
