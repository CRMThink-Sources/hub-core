import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixMessageUpdateHandler } from './bitrix-message-update.handler'
import { BitrixMessageDeleteHandler } from './bitrix-message-delete.handler'
import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/queue/thinkzap-inbound.queue', () => ({
  enqueueThinkzapInboundJob: enqueueMock,
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function event(name: string): IBX24MessageEvent {
  return {
    event: name,
    ts: '1',
    auth: { domain: 'x.bitrix24.com' },
    data: {
      CONNECTOR: 'c',
      LINE: '7',
      MESSAGES: [{ im: { message_id: '9' } }],
    },
  } as unknown as IBX24MessageEvent
}

describe.each([
  ['edição', new BitrixMessageUpdateHandler(), 'ONIMCONNECTORMESSAGEUPDATE'],
  ['exclusão', new BitrixMessageDeleteHandler(), 'ONIMCONNECTORMESSAGEDELETE'],
])('handler de %s', (_label, handler, type) => {
  beforeEach(() => enqueueMock.mockClear())

  it('declara o tipo do evento', () => {
    expect(handler.eventType).toBe(type)
  })

  it('enfileira o evento com traceKey e sem jobId determinístico', async () => {
    const body = event(type)

    await handler.handle(body)

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const [job, opts] = enqueueMock.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ]
    expect(job).toMatchObject({ source: 'bitrix', type, body })
    expect(typeof job.traceKey).toBe('string')
    expect(opts).toBeUndefined()
  })
})
