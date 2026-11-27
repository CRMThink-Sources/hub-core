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
  status: vi.fn().mockResolvedValue(undefined),
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
  processHubMessageDeliveryStatus: m.status,
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

import { jobLifecycleLogLevel } from './thinkzap-inbound.worker'

const run = (type: string, attemptsMade = 0) =>
  m.captured.fn!(
    {
      id: '1',
      attemptsMade,
      opts: { attempts: 3 },
      data: { source: 'bitrix', type, traceKey: 't', body: { x: 1 } },
    },
    'tok',
  )

describe('despacho do status da HubMessage no thinkzap-inbound', () => {
  beforeEach(() => vi.clearAllMocks())

  it('repassa traceKey e a tentativa de registro ao processor', async () => {
    await m.captured.fn!(
      {
        id: '1',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          source: 'hubmessage-status',
          type: 'ErrorCallback',
          traceKey: 't',
          body: { _id: 'prov-1' },
          recordOnlyAttempt: 2,
        },
      },
      'tok',
    )

    expect(m.status).toHaveBeenCalledWith(
      { message: { _id: 'prov-1' } },
      expect.objectContaining({ traceKey: 't', recordOnlyAttempt: 2 }),
    )
  })
})

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

  it.each([
    [0, false],
    [1, false],
    [2, true],
  ])(
    'com %i tentativa(s) anterior(es) informa isLastAttempt=%s',
    async (attemptsMade, isLastAttempt) => {
      await run('ONIMCONNECTORMESSAGEADD', attemptsMade)
      expect(m.received).toHaveBeenCalledWith(
        { x: 1 },
        expect.objectContaining({ isLastAttempt }),
      )
    },
  )
})

describe('nível do log de ciclo de vida do job', () => {
  it.each([
    ['retentativa de registro de status', { recordOnlyAttempt: 1 }, 'debug'],
    ['status original', {}, 'info'],
  ] as const)('%s', (_, extra, level) => {
    expect(
      jobLifecycleLogLevel({
        source: 'hubmessage-status',
        type: 'MessageStatusCallback',
        traceKey: 't',
        body: {},
        ...extra,
      }),
    ).toBe(level)
  })

  it('outras origens seguem em info', () => {
    expect(
      jobLifecycleLogLevel({
        source: 'bitrix',
        type: 'ONIMCONNECTORMESSAGEADD',
        traceKey: 't',
        body: {},
      } as Parameters<typeof jobLifecycleLogLevel>[0]),
    ).toBe('info')
  })

  it('sem dados do job segue em info', () => {
    expect(jobLifecycleLogLevel(undefined)).toBe('info')
  })
})
