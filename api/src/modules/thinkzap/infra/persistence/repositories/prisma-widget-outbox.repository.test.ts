import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createMock,
  findUniqueMock,
  createManyMock,
  findManyMock,
  updateManyMock,
  countMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createManyMock: vi.fn(),
  findManyMock: vi.fn(),
  updateManyMock: vi.fn(),
  countMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapWidgetOutbox: {
      create: createMock,
      findUnique: findUniqueMock,
      createMany: createManyMock,
      findMany: findManyMock,
      updateMany: updateManyMock,
      count: countMock,
    },
  },
}))

import {
  CreateWidgetOutboxInput,
  PrismaWidgetOutboxRepository,
} from './prisma-widget-outbox.repository'

const sut = () => new PrismaWidgetOutboxRepository()

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'inst-1',
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'deal',
  entityId: '42',
  kind: 'TEMPLATE',
  templateName: 'order_update',
  templateLanguage: 'pt_BR',
  templateParameters: ['Maria'],
  templateButtonParameters: null,
  templateHeaderImageUrl: null,
  buttonPayload: null,
  status: 'PENDING',
  providerMessageId: null,
  timelineNotifiedAt: null,
  attempts: 0,
  lastError: null,
  operatorBitrixUserId: null,
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
  queueSeq: null,
  cadenceWaitUntil: null,
  createdAt: new Date('2026-10-16T12:00:00.000Z'),
  sentAt: null,
  ...overrides,
})

const input: CreateWidgetOutboxInput = {
  kind: 'TEMPLATE',
  clientMessageId: 'client-1',
  instanceId: 'inst-1',
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'deal',
  entityId: '42',
  templateName: 'order_update',
  templateLanguage: 'pt_BR',
  templateParameters: ['Maria'],
}

const createData = (): Record<string, unknown> =>
  (createMock.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data

describe('PrismaWidgetOutboxRepository — botões de template', () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue(dbRow())
    findUniqueMock.mockReset().mockResolvedValue(null)
  })

  it('grava os valores dos botões dinâmicos', async () => {
    const buttons = [{ index: 1, subType: 'URL' as const, value: 'PED-1' }]

    await sut().create({ ...input, templateButtonParameters: buttons })

    expect(createData().templateButtonParameters).toEqual(buttons)
  })

  it('omite a coluna quando a lista de botões é vazia ou ausente', async () => {
    await sut().create({ ...input, templateButtonParameters: [] })
    await sut().create(input)

    for (const [call] of createMock.mock.calls as [{ data: object }][]) {
      expect(call.data).not.toHaveProperty('templateButtonParameters')
    }
  })

  it('lê os valores gravados', async () => {
    const buttons = [{ index: 0, subType: 'COPY_CODE', value: 'BLACK10' }]
    findUniqueMock.mockResolvedValue(
      dbRow({ templateButtonParameters: buttons }),
    )

    const record = await sut().findById('outbox-1')

    expect(record?.templateButtonParameters).toEqual(buttons)
  })

  it('row antiga, sem a coluna, lê null', async () => {
    findUniqueMock.mockResolvedValue(dbRow())

    const record = await sut().findById('outbox-1')

    expect(record?.templateButtonParameters).toBeNull()
  })

  it('JSON com formato inesperado lê null em vez de quebrar', async () => {
    findUniqueMock.mockResolvedValue(
      dbRow({ templateButtonParameters: [{ index: 'x', value: 1 }] }),
    )

    const record = await sut().findById('outbox-1')

    expect(record?.templateButtonParameters).toBeNull()
  })
})

describe('PrismaWidgetOutboxRepository — partes, grupo e cadência', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createManyMock.mockResolvedValue({ count: 0 })
    updateManyMock.mockResolvedValue({ count: 1 })
  })

  const part = (i: number) => ({
    ...input,
    kind: 'MEDIA' as const,
    origin: 'WIDGET_ATTACHMENT' as const,
    clientMessageId: `client-${i}`,
    dispatchGroupId: 'g-1',
    partIndex: i,
    mediaType: 'image' as const,
    mediaSource: { kind: 'url', url: `https://x/${i}.png` },
  })

  it('createParts grava ignorando duplicadas e devolve na ordem da entrada', async () => {
    findManyMock.mockResolvedValue([
      dbRow({ id: 'r2', clientMessageId: 'client-1', partIndex: 1 }),
      dbRow({ id: 'r1', clientMessageId: 'client-0', partIndex: 0 }),
    ])

    const rows = await sut().createParts([part(0), part(1)])

    expect(createManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )
    const data = (createManyMock.mock.calls[0]![0] as { data: object[] }).data
    expect(data[0]).toMatchObject({
      mediaSource: { kind: 'url', url: 'https://x/0.png' },
      dispatchGroupId: 'g-1',
      origin: 'WIDGET_ATTACHMENT',
    })
    expect(rows.map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('createParts vazio não toca o banco', async () => {
    expect(await sut().createParts([])).toEqual([])
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('lê os campos novos da row', async () => {
    findUniqueMock.mockResolvedValue(
      dbRow({
        origin: 'OPERATOR',
        kind: 'MEDIA',
        mediaType: 'audio',
        mediaSource: { kind: 'bitrix-disk', fileId: '9' },
        queueSeq: 7,
        mediaTypeInvalid: undefined,
      }),
    )

    const record = await sut().findById('outbox-1')

    expect(record).toMatchObject({
      origin: 'OPERATOR',
      mediaType: 'audio',
      mediaSource: { kind: 'bitrix-disk', fileId: '9' },
      queueSeq: 7,
    })
  })

  it('mediaType desconhecido lê null', async () => {
    findUniqueMock.mockResolvedValue(dbRow({ mediaType: 'gif' }))
    expect((await sut().findById('outbox-1'))?.mediaType).toBeNull()
  })

  it('setQueueSeq só grava a primeira posição', async () => {
    await sut().setQueueSeq('outbox-1', 3)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'outbox-1', queueSeq: null },
      data: { queueSeq: 3 },
    })
  })

  it('markWaiting só marca row pendente', async () => {
    const until = new Date('2026-10-21T13:05:40.000Z')
    await sut().markWaiting('outbox-1', until)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'outbox-1', status: 'PENDING' },
      data: { cadenceWaitUntil: until },
    })
  })

  it('groupOutcome devolve as partes ordenadas', async () => {
    findManyMock.mockResolvedValue([
      dbRow({ id: 'a', partIndex: 0, status: 'SENT' }),
      dbRow({ id: 'b', partIndex: 1, status: 'FAILED', lastError: 'x' }),
    ])

    const parts = await sut().groupOutcome('g-1')

    expect(findManyMock).toHaveBeenCalledWith({
      where: { dispatchGroupId: 'g-1' },
      orderBy: { partIndex: 'asc' },
    })
    expect(parts.map(p => [p.id, p.status])).toEqual([
      ['a', 'SENT'],
      ['b', 'FAILED'],
    ])
  })

  it('claimGroupTimelineNotification: das concorrentes, só uma vence', async () => {
    let notified = false
    updateManyMock.mockImplementation(() => {
      if (notified) return Promise.resolve({ count: 0 })
      notified = true
      return Promise.resolve({ count: 1 })
    })

    const results = await Promise.all([
      sut().claimGroupTimelineNotification('g-1'),
      sut().claimGroupTimelineNotification('g-1'),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { dispatchGroupId: 'g-1', partIndex: 0, timelineNotifiedAt: null },
      data: { timelineNotifiedAt: expect.any(Date) as Date },
    })
  })

  it('findLiveIds filtra PENDING e SENDING', async () => {
    findManyMock.mockResolvedValue([{ id: 'a' }])
    expect(await sut().findLiveIds(['a', 'b'])).toEqual(new Set(['a']))
  })

  it('findByClientMessageIds é escopado pela instalação', async () => {
    findManyMock.mockResolvedValue([dbRow()])
    await sut().findByClientMessageIds('domain-1', ['client-1'])
    expect(findManyMock).toHaveBeenCalledWith({
      where: { domainId: 'domain-1', clientMessageId: { in: ['client-1'] } },
    })
  })
})
