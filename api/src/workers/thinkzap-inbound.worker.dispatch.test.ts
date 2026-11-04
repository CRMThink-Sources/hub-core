import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  captured: {
    fn: undefined as
      | undefined
      | ((job: unknown, token: string) => Promise<void>),
  },
  received: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bullmq', () => ({
  DelayedError: class DelayedError extends Error {},
  Worker: class {
    constructor(
      _name: string,
      fn: (job: unknown, token: string) => Promise<void>,
    ) {
      m.captured.fn = fn
    }
    on() {
      return this
    }
  },
}))
vi.mock('@/queue/redis-connection', () => ({ bullBaseOptions: {} }))
vi.mock('@/queue/thinkzap-inbound.queue', () => ({ THINKZAP_INBOUND: 'q' }))
vi.mock('./z-api-received-message.processor', () => ({
  processZApiReceivedMessage: vi.fn(),
}))
vi.mock('./z-api-sent-by-me.processor', () => ({
  processZApiSentByMeMessage: vi.fn(),
}))
vi.mock('@/shared/infra/handlers/z-api/received-message.handler', () => ({
  ZAPI_SENT_BY_ME_JOB_TYPE: 'sent-by-me',
}))
vi.mock('./hubmessage-received-message.processor', () => ({
  processHubMessageReceivedMessage: vi.fn(),
}))
vi.mock('./hubmessage-status.processor', () => ({
  processHubMessageDeliveryStatus: vi.fn(),
}))
vi.mock('./bitrix-bot-event.processor', () => ({
  processBitrixBotEvent: vi.fn(),
}))
vi.mock('./bitrix-received-message.processor', () => ({
  processBitrixReceivedMessage: m.received,
}))
vi.mock('./bitrix-message-update.processor', () => ({
  processBitrixMessageUpdate: m.update,
}))
vi.mock('./bitrix-message-delete.processor', () => ({
  processBitrixMessageDelete: m.del,
}))
vi.mock('./thinkzap-connection-events.worker', () => ({}))
vi.mock('./thinkzap-line-connected-sync.worker', () => ({}))
vi.mock('./append-job-log', () => ({ makeAppendJobLog: () => vi.fn() }))
vi.mock('@/shared/infra/bitrix-limits/install-bitrix-limits', () => ({
  installBitrixLimits: vi.fn(),
}))
vi.mock('@/shared/infra/bitrix-limits/bitrix-limits.port', () => ({
  BitrixMethodPausedError: class extends Error {},
}))
vi.mock('@/shared/infra/log-error', () => ({ jobFailureLogFields: () => ({}) }))
vi.mock('@/shared/infra/logger', () => ({
  workerLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import './thinkzap-inbound.worker'

const run = (type: string) =>
  m.captured.fn!(
    {
      id: '1',
      data: { source: 'bitrix', type, traceKey: 't', body: { x: 1 } },
    },
    'tok',
  )

describe('despacho de jobs bitrix do thinkzap-inbound', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edição vai para o processor de edição', async () => {
    await run('ONIMCONNECTORMESSAGEUPDATE')
    expect(m.update).toHaveBeenCalledWith({ x: 1 })
    expect(m.del).not.toHaveBeenCalled()
    expect(m.received).not.toHaveBeenCalled()
  })

  it('exclusão vai para o processor de exclusão', async () => {
    await run('ONIMCONNECTORMESSAGEDELETE')
    expect(m.del).toHaveBeenCalledWith({ x: 1 })
    expect(m.update).not.toHaveBeenCalled()
    expect(m.received).not.toHaveBeenCalled()
  })

  it('mensagem recebida segue no processor de mensagem recebida', async () => {
    await run('ONIMCONNECTORMESSAGEADD')
    expect(m.received).toHaveBeenCalledTimes(1)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.del).not.toHaveBeenCalled()
  })
})
