import { describe, expect, it, vi } from 'vitest'
import { UnrecoverableError } from 'bullmq'
import {
  captureInboundFailure,
  isFinalInboundFailure,
  type CaptureInboundFailureDeps,
  type FailedInboundJob,
} from './capture-inbound-failure'

const job = (overrides: Partial<FailedInboundJob> = {}): FailedInboundJob => ({
  id: 'job-1',
  data: {
    source: 'hubmessage',
    type: 'message',
    traceKey: 'trace-1',
    body: { channel_id: 'C-9', _id: 'm-1' },
  },
  attemptsMade: 3,
  opts: { attempts: 3 },
  ...overrides,
})

function makeDeps(overrides: Partial<CaptureInboundFailureDeps> = {}) {
  const recordFailure = vi
    .fn<CaptureInboundFailureDeps['attempts']['recordFailure']>()
    .mockResolvedValue(undefined)
  const create = vi
    .fn<CaptureInboundFailureDeps['failures']['create']>()
    .mockResolvedValue('failure-1')
  const resolveOwner = vi
    .fn<CaptureInboundFailureDeps['resolveOwner']>()
    .mockResolvedValue({
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
      instanceId: 'inst-1',
    })
  const warn = vi.fn()
  const error = vi.fn()

  const deps: CaptureInboundFailureDeps = {
    attempts: { recordFailure },
    failures: { create },
    resolveOwner,
    logger: { warn, error } as never,
    ...overrides,
  }

  return { deps, recordFailure, create, resolveOwner, warn, error }
}

describe('isFinalInboundFailure', () => {
  it('é final quando as tentativas da fila acabaram', () => {
    expect(
      isFinalInboundFailure(
        { attemptsMade: 3, opts: { attempts: 3 } },
        new Error('x'),
      ),
    ).toBe(true)
  })

  it('não é final com tentativa pela frente', () => {
    expect(
      isFinalInboundFailure(
        { attemptsMade: 1, opts: { attempts: 3 } },
        new Error('x'),
      ),
    ).toBe(false)
  })

  /** O BullMQ não retenta `UnrecoverableError`, mesmo com tentativa sobrando. */
  it('é final com UnrecoverableError', () => {
    expect(
      isFinalInboundFailure(
        { attemptsMade: 1, opts: { attempts: 3 } },
        new UnrecoverableError('x'),
      ),
    ).toBe(true)
  })

  it('sem `attempts` configurado, a primeira falha é final', () => {
    expect(
      isFinalInboundFailure({ attemptsMade: 1, opts: {} }, new Error('x')),
    ).toBe(true)
  })
})

describe('captureInboundFailure', () => {
  it('tentativas esgotadas: grava a tentativa e a falha de recebimento', async () => {
    const { deps, recordFailure, create } = makeDeps()

    await captureInboundFailure(
      job(),
      new Error('Instance has no vinculated channel'),
      80,
      deps,
    )

    expect(recordFailure).toHaveBeenCalledWith(
      { kind: 'INBOUND', id: 'job-1' },
      {
        errorCode: 'UNCLASSIFIED',
        message: 'Instance has no vinculated channel',
        durationMs: 80,
      },
    )
    expect(create).toHaveBeenCalledWith({
      jobId: 'job-1',
      source: 'hubmessage',
      type: 'message',
      traceKey: 'trace-1',
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
      instanceId: 'inst-1',
      errorCode: 'UNCLASSIFIED',
      errorMessage: 'Instance has no vinculated channel',
      attempts: 3,
      payload: { channel_id: 'C-9', _id: 'm-1' },
      previousFailureId: null,
    })
  })

  /** Reprocessado que falha de novo gera nova falha, e a anterior continua `REPROCESSED`. */
  it('evento reprocessado que falha de novo liga a nova falha à anterior', async () => {
    const { deps, create } = makeDeps()

    await captureInboundFailure(
      job({ id: 'reprocess-3f1c8a52-7b0e-4d27-9a31-5c2e6f0b1d44-1' }),
      new Error('x'),
      1,
      deps,
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        previousFailureId: '3f1c8a52-7b0e-4d27-9a31-5c2e6f0b1d44',
      }),
    )
  })

  /** Falha que se recupera na tentativa seguinte não pode gerar falha de recebimento. */
  it('na falha final loga o código thinkzap.inbound.event_failed com o traceKey', async () => {
    const { deps, error } = makeDeps()

    await captureInboundFailure(job(), new Error('x'), 1, deps)

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'thinkzap.inbound.event_failed',
        jobId: 'job-1',
        source: 'hubmessage',
        traceKey: 'trace-1',
      }),
      'Evento recebido esgotou as tentativas',
    )
  })

  it('com tentativa pela frente: grava só a tentativa, não a falha', async () => {
    const { deps, recordFailure, create, error } = makeDeps()

    await captureInboundFailure(
      job({ attemptsMade: 1 }),
      new Error('x'),
      undefined,
      deps,
    )

    expect(recordFailure).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('resolve o portal a partir do que o body aponta', async () => {
    const { deps, resolveOwner } = makeDeps()

    await captureInboundFailure(job(), new Error('x'), 1, deps)

    expect(resolveOwner).toHaveBeenCalledWith({ channelId: 'C-9' })
  })

  it('evento sem portal identificável: registra a falha sem portal', async () => {
    const { deps, create } = makeDeps({
      resolveOwner: vi.fn().mockResolvedValue({}),
    })

    await captureInboundFailure(job(), new Error('x'), 1, deps)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: null,
        domainName: null,
        instanceId: null,
      }),
    )
  })

  it('o resolvedor que lança não impede o registro da falha', async () => {
    const { deps, create } = makeDeps({
      resolveOwner: vi.fn().mockRejectedValue(new Error('banco fora')),
    })

    await captureInboundFailure(job(), new Error('x'), 1, deps)

    expect(create).toHaveBeenCalledTimes(1)
  })

  /** O handler `failed` não pode derrubar o worker por erro de gravação. */
  it('erro ao gravar a falha: só avisa no log e não lança', async () => {
    const { deps, create, warn } = makeDeps()
    create.mockRejectedValue(new Error('banco fora'))

    await expect(
      captureInboundFailure(job(), new Error('x'), 1, deps),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('erro ao gravar a tentativa: não lança', async () => {
    const { deps, recordFailure, warn } = makeDeps()
    recordFailure.mockRejectedValue(new Error('banco fora'))

    await expect(
      captureInboundFailure(job(), new Error('x'), 1, deps),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('sem job.id não grava nada (não há como ligar as tentativas)', async () => {
    const { deps, recordFailure, create } = makeDeps()

    await captureInboundFailure(job({ id: undefined }), new Error('x'), 1, deps)
    await captureInboundFailure(undefined, new Error('x'), 1, deps)

    expect(recordFailure).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('corta a mensagem de erro enorme para a falha final ser gravada', async () => {
    const { deps, create } = makeDeps()

    await captureInboundFailure(job(), new Error('x'.repeat(5000)), 1, deps)

    const [input] = create.mock.calls[0]!
    expect(input.errorMessage).toHaveLength(2000)
  })

  it('erro que não é Error vira texto', async () => {
    const { deps, create } = makeDeps()

    await captureInboundFailure(job(), 'quebrou', 1, deps)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: 'quebrou' }),
    )
  })

  it('traceKey ou type vazios viram nulo / texto vazio', async () => {
    const { deps, create } = makeDeps()

    await captureInboundFailure(
      job({
        data: { source: 'hubmessage', type: '', traceKey: '', body: {} },
      }),
      new Error('x'),
      1,
      deps,
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: '', traceKey: null }),
    )
  })
})
