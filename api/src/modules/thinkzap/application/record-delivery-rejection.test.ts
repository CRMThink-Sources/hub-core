import { describe, expect, it, vi } from 'vitest'

import type { HubMessageStateItem } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  recordDeliveryRejection,
  REJECTION_RETRY_DELAYS_MS,
} from './record-delivery-rejection'

const AT = new Date('2026-11-27T12:00:00.000Z')

const stateItem: HubMessageStateItem = {
  identifier: 'state-1',
  state: { '@class': '.Failed', name: 'ERROR' },
  external_information: {
    errors: [{ code: '131047', title: 'Re-engagement message' }],
  },
}

const trackedRow = {
  id: 'outbox-1',
  origin: 'ROBOT_TEMPLATE',
  smsMessageId: null,
} as WidgetOutboxRecord

function makeDeps(
  row: WidgetOutboxRecord | null = trackedRow,
  firstRejection = true,
) {
  return {
    outbox: {
      findByProviderMessageId: vi
        .fn<PrismaWidgetOutboxRepository['findByProviderMessageId']>()
        .mockResolvedValue(row),
      markRejected: vi
        .fn<PrismaWidgetOutboxRepository['markRejected']>()
        .mockResolvedValue(firstRejection),
    },
    publish: vi.fn<(outboxId: string) => Promise<void>>().mockResolvedValue(),
    now: () => AT,
  }
}

const input = {
  instanceId: 'inst-db-1',
  providerMessageId: 'prov-1',
  stateItem,
}

describe('recordDeliveryRejection', () => {
  it('grava código e motivo da recusa e publica o aviso', async () => {
    const deps = makeDeps()

    await expect(recordDeliveryRejection(input, deps)).resolves.toBe('recorded')

    expect(deps.outbox.findByProviderMessageId).toHaveBeenCalledWith(
      'inst-db-1',
      'prov-1',
    )
    expect(deps.outbox.markRejected).toHaveBeenCalledWith('outbox-1', {
      code: '131047',
      reason: 'Re-engagement message',
      at: AT,
    })
    expect(deps.publish).toHaveBeenCalledWith('outbox-1')
  })

  it('sem código da Meta grava code nulo', async () => {
    const deps = makeDeps()

    await recordDeliveryRejection(
      {
        ...input,
        stateItem: { state: { name: 'ERROR', failedDescription: 'HTTP 500' } },
      },
      deps,
    )

    expect(deps.outbox.markRejected).toHaveBeenCalledWith('outbox-1', {
      code: null,
      reason: 'HTTP 500',
      at: AT,
    })
  })

  it('corta o motivo em 2000 caracteres', async () => {
    const deps = makeDeps()

    await recordDeliveryRejection(
      {
        ...input,
        stateItem: {
          state: { name: 'ERROR', failedDescription: 'x'.repeat(2500) },
        },
      },
      deps,
    )

    expect(deps.outbox.markRejected.mock.calls[0]?.[1].reason).toHaveLength(
      2000,
    )
  })

  it('segunda entrega devolve duplicate e publica de novo', async () => {
    const deps = makeDeps(trackedRow, false)

    await expect(recordDeliveryRejection(input, deps)).resolves.toBe(
      'duplicate',
    )

    expect(deps.publish).toHaveBeenCalledWith('outbox-1')
  })

  it.each([
    ['canal aberto', { origin: 'OPERATOR', smsMessageId: null }],
    ['campanha de SMS', { origin: 'WIDGET', smsMessageId: 'msg-1' }],
  ])('envio não acompanhado (%s) não grava nem publica', async (_, fields) => {
    const deps = makeDeps({ ...trackedRow, ...fields } as WidgetOutboxRecord)

    await expect(recordDeliveryRejection(input, deps)).resolves.toBe(
      'untracked',
    )

    expect(deps.outbox.markRejected).not.toHaveBeenCalled()
    expect(deps.publish).not.toHaveBeenCalled()
  })

  it('row ausente devolve row-missing', async () => {
    const deps = makeDeps(null)

    await expect(recordDeliveryRejection(input, deps)).resolves.toBe(
      'row-missing',
    )

    expect(deps.outbox.markRejected).not.toHaveBeenCalled()
    expect(deps.publish).not.toHaveBeenCalled()
  })

  it('são cinco esperas pela row, cada vez maiores', () => {
    expect(REJECTION_RETRY_DELAYS_MS).toEqual([
      10_000, 30_000, 60_000, 120_000, 300_000,
    ])
  })
})
