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

describe('ReceivedMessageHandler (enviadas pelo próprio número)', () => {
  it('descarta a enviada pela API sem enfileirar', async () => {
    enqueueMock.mockClear()

    await new ReceivedMessageHandler().handle(
      baseEvent({ fromMe: true, fromApi: true }),
    )

    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('enfileira a enviada pelo aparelho com tipo e jobId próprios', async () => {
    enqueueMock.mockClear()

    await new ReceivedMessageHandler().handle(
      baseEvent({ fromMe: true, fromApi: false, messageId: 'MSG-9' }),
    )

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const [job, opts] = enqueueMock.mock.calls[0] as [
      { source: string; type: string },
      { jobId: string },
    ]
    expect(job).toMatchObject({ source: 'z-api', type: 'sent-by-me' })
    expect(opts.jobId).toBe('zapi-me-MSG-9')
  })

  it('edição e remoção do aparelho não colidem com as do contato', () => {
    const edit = { isEdit: true, editMessageId: 'MSG-1' }
    const revoke = { notification: 'REVOKE', messageId: 'MSG-1' }

    expect(resolveZApiInboundJobId(baseEvent({ fromMe: true, ...edit }))).toBe(
      'zapi-me-edit-MSG-1',
    )
    expect(
      resolveZApiInboundJobId(baseEvent({ fromMe: true, ...revoke })),
    ).toBe('zapi-me-revoke-MSG-1')
    expect(resolveZApiInboundJobId(baseEvent(edit))).toBe('zapi-edit-MSG-1')
  })

  it('mensagem do contato segue com tipo de recebida', async () => {
    enqueueMock.mockClear()

    await new ReceivedMessageHandler().handle(baseEvent())

    const [job] = enqueueMock.mock.calls[0] as [{ type: string }]
    expect(job.type).toBe('received-message')
  })
})
