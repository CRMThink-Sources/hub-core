import { describe, expect, it, vi } from 'vitest'

/** Só as opções do job importam aqui: conexão e `Queue` são dublados. */
const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn((_name: string, data: unknown, opts: { jobId?: string }) =>
    Promise.resolve({ id: opts.jobId ?? 'random-id', data }),
  ),
}))

vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  enqueueThinkzapWidgetOutboundJob,
  widgetSendJobId,
} from './thinkzap-widget-outbound.queue'

describe('enqueueThinkzapWidgetOutboundJob', () => {
  /**
   * Com 3 tentativas de 1 s e 2 s, uma instabilidade de segundos no Bitrix interno
   * esgotava o job. 4 tentativas a partir de 10 s cobrem ~70 s até a última.
   */
  it('agenda 4 tentativas com espera exponencial a partir de 10 s', async () => {
    await enqueueThinkzapWidgetOutboundJob(
      { kind: 'send', outboxId: 'outbox-1' },
      { jobId: widgetSendJobId('outbox-1') },
    )

    const [, , opts] = addMock.mock.calls[0]!
    expect(opts).toMatchObject({
      attempts: 4,
      backoff: { type: 'exponential', delay: 10_000 },
      jobId: 'widget-send-outbox-1',
    })

    // Esperas do BullMQ exponencial: delay * 2^(tentativa-1) entre as tentativas.
    const waits = [1, 2, 3].map(n => 10_000 * 2 ** (n - 1))
    expect(waits.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(60_000)
  })
})
