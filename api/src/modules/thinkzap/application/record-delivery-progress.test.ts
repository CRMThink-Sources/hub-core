import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/shared/infra/logger', () => ({
  createWorkerSourceLogger: () => logger,
}))

import type { HubMessageStateItem } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  progressKindOf,
  PROGRESS_RETRY_DELAYS_MS,
  recordDeliveryProgress,
  retryDelaysFor,
} from './record-delivery-progress'
import { REJECTION_RETRY_DELAYS_MS } from './record-delivery-rejection'

const NOW = new Date('2026-11-27T12:00:00.000Z')
/** `moment` do callback vem em segundos (amostras reais). */
const MOMENT_S = 1795600000

const readItem: HubMessageStateItem = {
  identifier: 'state-read',
  moment: MOMENT_S,
  type: 'MessageStatusCallback',
  state: { name: 'READ' },
}

const receivedItem: HubMessageStateItem = {
  identifier: 'state-received',
  moment: MOMENT_S,
  type: 'DeliveryCallback',
  state: { name: 'RECEIVED' },
}

const trackedRow = {
  id: 'outbox-1',
  origin: 'ROBOT_TEMPLATE',
  smsMessageId: null,
  rejectedAt: null,
} as WidgetOutboxRecord

function makeDeps(row: WidgetOutboxRecord | null = trackedRow, first = true) {
  return {
    outbox: {
      findByProviderMessageId: vi
        .fn<PrismaWidgetOutboxRepository['findByProviderMessageId']>()
        .mockResolvedValue(row),
      markDelivered: vi
        .fn<PrismaWidgetOutboxRepository['markDelivered']>()
        .mockResolvedValue(first),
      markRead: vi
        .fn<PrismaWidgetOutboxRepository['markRead']>()
        .mockResolvedValue(first),
    },
    publish: vi.fn<(outboxId: string) => Promise<void>>().mockResolvedValue(),
    now: () => NOW,
  }
}

const input = (stateItem: HubMessageStateItem | undefined) => ({
  instanceId: 'inst-db-1',
  providerMessageId: 'prov-1',
  stateItem,
})

describe('progressKindOf', () => {
  it.each([
    [receivedItem, 'delivered'],
    [readItem, 'read'],
    [{ state: { name: 'SENT' } }, null],
    [{ state: { name: 'ERROR' } }, null],
    [{ state: { '@class': '.Failed', name: 'READ' } }, null],
    [undefined, null],
  ] as const)('%o -> %s', (item, kind) => {
    expect(progressKindOf(item)).toBe(kind)
  })
})

describe('retryDelaysFor', () => {
  it('progresso usa duas esperas; recusa segue com cinco', () => {
    expect(PROGRESS_RETRY_DELAYS_MS).toEqual([10_000, 60_000])
    expect(retryDelaysFor(readItem)).toBe(PROGRESS_RETRY_DELAYS_MS)
    expect(retryDelaysFor(receivedItem)).toBe(PROGRESS_RETRY_DELAYS_MS)
    expect(retryDelaysFor({ state: { name: 'ERROR' } })).toBe(
      REJECTION_RETRY_DELAYS_MS,
    )
  })
})

describe('recordDeliveryProgress', () => {
  beforeEach(() => vi.clearAllMocks())

  it('READ grava a leitura no momento do evento e publica', async () => {
    const deps = makeDeps()

    await expect(recordDeliveryProgress(input(readItem), deps)).resolves.toBe(
      'recorded',
    )

    expect(deps.outbox.findByProviderMessageId).toHaveBeenCalledWith(
      'inst-db-1',
      'prov-1',
    )
    expect(deps.outbox.markRead).toHaveBeenCalledWith(
      'outbox-1',
      new Date(MOMENT_S * 1000),
    )
    expect(deps.outbox.markDelivered).not.toHaveBeenCalled()
    expect(deps.publish).toHaveBeenCalledWith('outbox-1')
  })

  it('RECEIVED grava a entrega', async () => {
    const deps = makeDeps()

    await expect(
      recordDeliveryProgress(input(receivedItem), deps),
    ).resolves.toBe('recorded')

    expect(deps.outbox.markDelivered).toHaveBeenCalledWith(
      'outbox-1',
      new Date(MOMENT_S * 1000),
    )
    expect(deps.outbox.markRead).not.toHaveBeenCalled()
  })

  /** `NOW` = 2026-11-27T12:00Z; a janela aceita de 2020-01-01 até um dia depois. */
  it.each([
    ['em milissegundos', MOMENT_S * 1000, NOW],
    ['muito no futuro', NOW.getTime() / 1000 + 2 * 86_400, NOW],
    ['antes de 2020', 1_500_000_000, NOW],
    ['válido', MOMENT_S, new Date(MOMENT_S * 1000)],
  ])('moment %s', async (_, moment, expected) => {
    const deps = makeDeps()

    await recordDeliveryProgress(input({ ...receivedItem, moment }), deps)

    expect(deps.outbox.markDelivered).toHaveBeenCalledWith('outbox-1', expected)
  })

  it('sem moment válido usa o relógio', async () => {
    const deps = makeDeps()

    await recordDeliveryProgress(
      input({ ...receivedItem, moment: undefined }),
      deps,
    )

    expect(deps.outbox.markDelivered).toHaveBeenCalledWith('outbox-1', NOW)
  })

  it('segunda entrega devolve duplicate e ainda publica', async () => {
    const deps = makeDeps(trackedRow, false)

    await expect(
      recordDeliveryProgress(input(receivedItem), deps),
    ).resolves.toBe('duplicate')

    expect(deps.publish).toHaveBeenCalledWith('outbox-1')
  })

  it('SENT é ignorado sem tocar o repositório', async () => {
    const deps = makeDeps()

    await expect(
      recordDeliveryProgress(input({ state: { name: 'SENT' } }), deps),
    ).resolves.toBe('ignored')

    expect(deps.outbox.findByProviderMessageId).not.toHaveBeenCalled()
    expect(deps.publish).not.toHaveBeenCalled()
  })

  it('campanha de SMS é untracked e não escreve', async () => {
    const deps = makeDeps({
      ...trackedRow,
      origin: 'WIDGET',
      smsMessageId: 'msg-1',
    } as WidgetOutboxRecord)

    await expect(recordDeliveryProgress(input(readItem), deps)).resolves.toBe(
      'untracked',
    )

    expect(deps.outbox.markRead).not.toHaveBeenCalled()
    expect(deps.publish).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('sem row devolve row-missing', async () => {
    const deps = makeDeps(null)

    await expect(recordDeliveryProgress(input(readItem), deps)).resolves.toBe(
      'row-missing',
    )

    expect(deps.outbox.markRead).not.toHaveBeenCalled()
    expect(deps.publish).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('row já recusada grava mesmo assim e avisa no log', async () => {
    const deps = makeDeps({
      ...trackedRow,
      rejectedAt: new Date('2026-11-27T11:00:00.000Z'),
    } as WidgetOutboxRecord)

    await expect(
      recordDeliveryProgress(input(receivedItem), deps),
    ).resolves.toBe('recorded')

    expect(deps.outbox.markDelivered).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAfterRejection: true,
        outboxId: 'outbox-1',
      }),
      expect.any(String),
    )
  })
})
