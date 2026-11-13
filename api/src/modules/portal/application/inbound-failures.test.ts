import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { InboundFailureRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-inbound-failure.repository'
import {
  GetInboundFailure,
  INBOUND_ERROR_PREVIEW_LENGTH,
  ListInboundFailures,
  ReprocessInboundFailures,
} from './inbound-failures'

const FAILURE_ID = '3f1c8a52-7b0e-4d27-9a31-5c2e6f0b1d44'

const record = (
  overrides: Partial<InboundFailureRecord> = {},
): InboundFailureRecord => ({
  id: FAILURE_ID,
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
  payload: {
    channel_id: 'C-9',
    _id: 'm-1',
    sender: { identifier: '5511999999999' },
    text: 'conteúdo do contato',
  },
  status: 'FAILED',
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  previousFailureId: null,
  createdAt: new Date('2026-11-13T10:00:00Z'),
  ...overrides,
})

const filters = {
  statuses: ['FAILED', 'REPROCESSED'] as ('FAILED' | 'REPROCESSED')[],
  from: new Date('2026-11-06T00:00:00Z'),
  to: new Date('2026-11-13T00:00:00Z'),
  page: 1,
  limit: 20,
}

describe('ListInboundFailures', () => {
  it('lista com o erro resumido, sem o conteúdo do evento', async () => {
    const long = 'x'.repeat(INBOUND_ERROR_PREVIEW_LENGTH + 50)
    const list = vi.fn().mockResolvedValue({
      items: [record({ errorMessage: long })],
      total: 1,
    })

    const result = await new ListInboundFailures({ list }).execute(filters)

    expect(result.total).toBe(1)
    expect(result.items[0]!.errorMessage).toBe(
      'x'.repeat(INBOUND_ERROR_PREVIEW_LENGTH) + '…',
    )
    expect(JSON.stringify(result)).not.toContain('conteúdo do contato')
    expect(result.items[0]).not.toHaveProperty('payload')
  })

  it('só a falha de origem reprocessável e ainda FAILED aparece como reprocessável', async () => {
    const list = vi.fn().mockResolvedValue({
      items: [
        record({ id: 'a', source: 'hubmessage', status: 'FAILED' }),
        record({ id: 'b', source: 'z-api', status: 'FAILED' }),
        record({ id: 'c', source: 'hubmessage', status: 'REPROCESSED' }),
      ],
      total: 3,
    })

    const result = await new ListInboundFailures({ list }).execute(filters)

    expect(result.items.map(i => [i.id, i.reprocessable])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ])
  })

  it('devolve a paginação pedida', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 0 })

    const result = await new ListInboundFailures({ list }).execute({
      ...filters,
      page: 3,
      limit: 50,
    })

    expect(result).toMatchObject({ page: 3, limit: 50 })
  })
})

describe('GetInboundFailure', () => {
  const attempt = {
    id: 'a1',
    attempt: 3,
    errorCode: 'UNCLASSIFIED',
    message: 'falhou',
    indeterminate: false,
    durationMs: 12,
    createdAt: new Date('2026-11-13T10:00:00Z'),
  }

  it('detalhe: campos seguros do evento e as tentativas, sem o conteúdo da mensagem', async () => {
    const listByRef = vi.fn().mockResolvedValue([attempt])

    const detail = await new GetInboundFailure(
      {
        findById: vi.fn().mockResolvedValue(record()),
        portalUserEmail: vi.fn(),
      },
      { listByRef },
    ).execute(FAILURE_ID)

    expect(listByRef).toHaveBeenCalledWith({ kind: 'INBOUND', id: 'job-1' })
    expect(detail).toMatchObject({
      traceKey: 'trace-1',
      errorCode: 'UNCLASSIFIED',
      payloadFields: { channelId: 'C-9', messageId: 'm-1' },
      attemptLog: [attempt],
    })
    const json = JSON.stringify(detail)
    expect(json).not.toContain('conteúdo do contato')
    expect(json).not.toContain('5511999999999')
  })

  it('traz o e-mail de quem reprocessou por último', async () => {
    const detail = await new GetInboundFailure(
      {
        findById: vi.fn().mockResolvedValue(
          record({
            status: 'REPROCESSED',
            reprocessCount: 1,
            lastReprocessedBy: 'user-1',
          }),
        ),
        portalUserEmail: vi.fn().mockResolvedValue('suporte@crmthink.com'),
      },
      { listByRef: vi.fn().mockResolvedValue([]) },
    ).execute(FAILURE_ID)

    expect(detail?.lastReprocessedByEmail).toBe('suporte@crmthink.com')
  })

  it('falha inexistente ou expurgada devolve null', async () => {
    await expect(
      new GetInboundFailure({
        findById: vi.fn().mockResolvedValue(null),
        portalUserEmail: vi.fn(),
      }).execute('x'),
    ).resolves.toBeNull()
  })

  it('erro ao ler as tentativas não derruba o detalhe', async () => {
    const detail = await new GetInboundFailure(
      {
        findById: vi.fn().mockResolvedValue(record()),
        portalUserEmail: vi.fn(),
      },
      { listByRef: vi.fn().mockRejectedValue(new Error('banco fora')) },
    ).execute(FAILURE_ID)

    expect(detail?.attemptLog).toEqual([])
    expect(detail?.errorCode).toBe('UNCLASSIFIED')
  })
})

describe('ReprocessInboundFailures', () => {
  function makeSut(found: InboundFailureRecord | null = record()) {
    const findById = vi.fn().mockResolvedValue(found)
    const claimForReprocess = vi.fn().mockResolvedValue(true)
    const revertReprocess = vi.fn().mockResolvedValue(undefined)
    const enqueue = vi.fn().mockResolvedValue(undefined)
    const sut = new ReprocessInboundFailures(
      { findById, claimForReprocess, revertReprocess },
      { enqueue },
    )
    return { sut, findById, claimForReprocess, revertReprocess, enqueue }
  }

  beforeEach(() => vi.clearAllMocks())

  it('origem reprocessável: reivindica, recoloca o evento original na fila e marca quem pediu', async () => {
    const { sut, claimForReprocess, enqueue } = makeSut()

    const results = await sut.execute({
      ids: [FAILURE_ID],
      portalUserId: 'user-1',
    })

    expect(results).toEqual([{ id: FAILURE_ID, status: 'requeued' }])
    expect(claimForReprocess).toHaveBeenCalledWith(FAILURE_ID, 'user-1')
    expect(enqueue).toHaveBeenCalledWith(
      {
        source: 'hubmessage',
        type: 'message',
        traceKey: 'trace-1',
        body: record().payload,
      },
      `reprocess-${FAILURE_ID}-1`,
    )
  })

  it('o jobId do reprocesso não colide com o do job falho nem com o reprocesso anterior', async () => {
    const { sut, enqueue } = makeSut(record({ reprocessCount: 2 }))

    await sut.execute({ ids: [FAILURE_ID], portalUserId: 'user-1' })

    const [, jobId] = enqueue.mock.calls[0]! as [unknown, string]
    expect(jobId).toBe(`reprocess-${FAILURE_ID}-3`)
    expect(jobId).not.toBe('job-1')
  })

  /** Reentregar poderia duplicar mensagem ou repetir ação no cliente. */
  it.each(['z-api', 'hubmessage-status', 'bitrix', 'bitrix-bot'])(
    'origem %s: recusa sem reivindicar nem enfileirar',
    async source => {
      const { sut, claimForReprocess, enqueue } = makeSut(record({ source }))

      const results = await sut.execute({
        ids: [FAILURE_ID],
        portalUserId: 'user-1',
      })

      expect(results).toEqual([{ id: FAILURE_ID, status: 'not-reprocessable' }])
      expect(claimForReprocess).not.toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
    },
  )

  it('falha já reprocessada por outra pessoa: conflito, e o evento não é enfileirado duas vezes', async () => {
    const { sut, claimForReprocess, enqueue } = makeSut()
    claimForReprocess.mockResolvedValue(false)

    const results = await sut.execute({
      ids: [FAILURE_ID],
      portalUserId: 'user-1',
    })

    expect(results).toEqual([{ id: FAILURE_ID, status: 'conflict' }])
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('falha inexistente ou expurgada: not-found', async () => {
    const { sut, enqueue } = makeSut(null)

    const results = await sut.execute({ ids: ['x'], portalUserId: 'user-1' })

    expect(results).toEqual([{ id: 'x', status: 'not-found' }])
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('falha ao enfileirar: devolve a falha a FAILED e avisa', async () => {
    const { sut, enqueue, revertReprocess } = makeSut()
    enqueue.mockRejectedValue(new Error('redis fora'))

    const results = await sut.execute({
      ids: [FAILURE_ID],
      portalUserId: 'user-1',
    })

    expect(results).toEqual([{ id: FAILURE_ID, status: 'schedule-failed' }])
    expect(revertReprocess).toHaveBeenCalledWith(FAILURE_ID)
  })

  it('lote: cada id tem o seu resultado e ids repetidos contam uma vez', async () => {
    const { sut, findById, enqueue } = makeSut()
    findById
      .mockResolvedValueOnce(record({ id: 'a' }))
      .mockResolvedValueOnce(record({ id: 'b', source: 'z-api' }))

    const results = await sut.execute({
      ids: ['a', 'b', 'a'],
      portalUserId: 'user-1',
    })

    expect(results).toEqual([
      { id: 'a', status: 'requeued' },
      { id: 'b', status: 'not-reprocessable' },
    ])
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('traceKey ausente vira texto vazio no evento reenfileirado', async () => {
    const { sut, enqueue } = makeSut(record({ traceKey: null }))

    await sut.execute({ ids: [FAILURE_ID], portalUserId: 'user-1' })

    expect(enqueue.mock.calls[0]![0]).toMatchObject({ traceKey: '' })
  })
})
