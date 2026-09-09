import { describe, expect, it, vi } from 'vitest'
import {
  BitrixReceivedMessageHandler,
  resolveBitrixInboundJobId,
} from './bitrix-received-message.handler'
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

function baseEvent(messageId: string | null = 'IM-1'): IBX24MessageEvent {
  return {
    event: 'ONIMCONNECTORMESSAGEADD',
    event_handler_id: 'handler-1',
    ts: '123',
    auth: { domain: 'example.bitrix24.com' } as IBX24MessageEvent['auth'],
    data: {
      CONNECTOR: 'connector-code',
      LINE: '1',
      MESSAGES: messageId
        ? [
            {
              im: { chat_id: '1', message_id: messageId },
              message: { user_id: '1', text: 'oi' },
              chat: { id: '1' },
            },
          ]
        : [],
    },
  }
}

describe('resolveBitrixInboundJobId', () => {
  it('mesmo message.im.message_id gera o mesmo jobId em duas chamadas', () => {
    expect(resolveBitrixInboundJobId(baseEvent('IM-1'))).toBe(
      resolveBitrixInboundJobId(baseEvent('IM-1')),
    )
    expect(resolveBitrixInboundJobId(baseEvent('IM-1'))).toBe('bitrix-IM-1')
  })

  it('não contém ":"', () => {
    expect(resolveBitrixInboundJobId(baseEvent('IM-1'))).not.toContain(':')
  })

  it('evento sem mensagens não gera jobId', () => {
    expect(resolveBitrixInboundJobId(baseEvent(null))).toBeUndefined()
  })
})

describe('BitrixReceivedMessageHandler', () => {
  it('enfileira com jobId determinístico derivado do evento', async () => {
    enqueueMock.mockClear()
    const handler = new BitrixReceivedMessageHandler()
    const event = baseEvent('IM-1')

    await handler.handle(event)

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const [, opts] = enqueueMock.mock.calls[0] as [unknown, { jobId: string }]
    expect(opts.jobId).toBe('bitrix-IM-1')
  })
})
