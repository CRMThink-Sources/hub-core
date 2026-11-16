import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { sequenceOutboxRows } from './sequence-outbox-rows'

const item = (provider: 'ZAPI' | 'HUBMESSAGE'): SubscriptionItem =>
  ({
    id: 'i1',
    name: 'L',
    subscription: 's',
    status: 'active',
    settings: DEFAULT_CONNECTOR_SETTINGS,
    vinculatedChannel: null,
    metadata:
      provider === 'ZAPI'
        ? { provider, zApiInstanceId: 'Z-1', zApiInstanceToken: 't' }
        : { provider, hubmessageChannelId: 'CH-1' },
  }) as SubscriptionItem

function deps() {
  let seq = 10
  return {
    cadence: {
      enqueue: vi.fn((_line: string, _id: string, _destination: string) =>
        Promise.resolve(++seq),
      ),
    },
    outbox: { setQueueSeq: vi.fn().mockResolvedValue(undefined) },
  }
}

describe('sequenceOutboxRows', () => {
  it('dá posição crescente na ordem das rows', async () => {
    const d = deps()

    await sequenceOutboxRows(d as never, item('ZAPI'), [
      { id: 'a', destination: '5511999990001' },
      { id: 'b', destination: '5511999990002' },
    ])

    expect(d.outbox.setQueueSeq.mock.calls).toEqual([
      ['a', 11],
      ['b', 12],
    ])
  })

  it('registra o destinatário de cada row na fila', async () => {
    const d = deps()

    await sequenceOutboxRows(d as never, item('ZAPI'), [
      { id: 'a', destination: '5511999990001' },
      { id: 'b', destination: '5511999990002' },
    ])

    expect(d.cadence.enqueue.mock.calls).toEqual([
      ['Z-1', 'a', '5511999990001'],
      ['Z-1', 'b', '5511999990002'],
    ])
  })

  it('row que já tem posição (reprocessamento) não ganha outra', async () => {
    const d = deps()

    await sequenceOutboxRows(d as never, item('ZAPI'), [
      { id: 'a', destination: '5511999990001', queueSeq: 3 },
    ])

    expect(d.cadence.enqueue).not.toHaveBeenCalled()
  })

  it('linha oficial não toca o sequenciador', async () => {
    const d = deps()

    await sequenceOutboxRows(d as never, item('HUBMESSAGE'), [
      { id: 'a', destination: '5511999990001' },
    ])

    expect(d.cadence.enqueue).not.toHaveBeenCalled()
  })

  it('sem cadência injetada não faz nada', async () => {
    const d = deps()

    await sequenceOutboxRows(
      { cadence: null, outbox: d.outbox },
      item('ZAPI'),
      [{ id: 'a', destination: '5511999990001' }],
    )

    expect(d.outbox.setQueueSeq).not.toHaveBeenCalled()
  })
})
