import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createMock, findUniqueMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapWidgetOutbox: {
      create: createMock,
      findUnique: findUniqueMock,
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
  buttonPayload: null,
  status: 'PENDING',
  providerMessageId: null,
  timelineNotifiedAt: null,
  attempts: 0,
  lastError: null,
  operatorBitrixUserId: null,
  smsSenderCode: null,
  smsMessageId: null,
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
