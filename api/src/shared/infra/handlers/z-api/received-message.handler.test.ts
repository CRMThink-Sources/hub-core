import { describe, expect, it, vi } from 'vitest'
import {
  ReceivedMessageHandler,
  resolveZApiInboundJobId,
} from './received-message.handler'
import type { ReceivedMessageEvent } from './z-api'

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/queue/thinkzap-inbound.queue', () => ({
  enqueueThinkzapInboundJob: enqueueMock,
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function baseEvent(overrides: Partial<ReceivedMessageEvent> = {}) {
  return {
    fromMe: false,
    isEdit: false,
    notification: '',
    messageId: 'MSG-1',
    editMessageId: '',
    instanceId: 'INST-1',
    phone: '5511999999999',
    isGroup: false,
    ...overrides,
  } as ReceivedMessageEvent
}

describe('resolveZApiInboundJobId', () => {
  it('mesmo messageId em evento de envio gera o mesmo jobId em duas chamadas', () => {
    const event = baseEvent()
    expect(resolveZApiInboundJobId(event)).toBe(
      resolveZApiInboundJobId(baseEvent()),
    )
    expect(resolveZApiInboundJobId(event)).toBe('zapi-MSG-1')
  })

  it('evento de envio e evento de edição da mesma mensagem geram jobId diferentes', () => {
    const sent = baseEvent({ messageId: 'MSG-1' })
    const edited = baseEvent({
      isEdit: true,
      messageId: 'MSG-1',
      editMessageId: 'MSG-1',
    })

    expect(resolveZApiInboundJobId(sent)).not.toBe(
      resolveZApiInboundJobId(edited),
    )
  })

  it('evento REVOKE gera jobId diferente do evento de envio original', () => {
    const sent = baseEvent({ messageId: 'MSG-1' })
    const revoked = baseEvent({ messageId: 'MSG-1', notification: 'REVOKE' })

    expect(resolveZApiInboundJobId(sent)).not.toBe(
      resolveZApiInboundJobId(revoked),
    )
  })

  it('nenhuma chave gerada contém ":"', () => {
    const cases = [
      baseEvent({ messageId: 'MSG-1' }),
      baseEvent({ isEdit: true, editMessageId: 'MSG-1' }),
      baseEvent({ messageId: 'MSG-1', notification: 'REVOKE' }),
    ]
    for (const event of cases) {
      expect(resolveZApiInboundJobId(event)).not.toContain(':')
    }
  })
})

describe('ReceivedMessageHandler', () => {
  it('enfileira com jobId determinístico derivado do evento', async () => {
    enqueueMock.mockClear()
    const handler = new ReceivedMessageHandler()
    const event = baseEvent({ messageId: 'MSG-1' })

    await handler.handle(event)

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const [, opts] = enqueueMock.mock.calls[0] as [unknown, { jobId: string }]
    expect(opts.jobId).toBe('zapi-MSG-1')
  })
})
