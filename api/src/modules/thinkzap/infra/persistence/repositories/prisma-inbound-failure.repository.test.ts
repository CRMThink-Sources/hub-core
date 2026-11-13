import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createMock,
  findManyMock,
  countMock,
  findUniqueMock,
  updateManyMock,
  deleteManyMock,
  portalUserFindUniqueMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
  portalUserFindUniqueMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapInboundFailure: {
      create: createMock,
      findMany: findManyMock,
      count: countMock,
      findUnique: findUniqueMock,
      updateMany: updateManyMock,
      deleteMany: deleteManyMock,
    },
    portalUser: { findUnique: portalUserFindUniqueMock },
  },
}))

import { PrismaInboundFailureRepository } from './prisma-inbound-failure.repository'

/** O `data` da primeira gravação, tipado: `mock.calls` devolve `any`. */
const firstCreateData = () =>
  (createMock.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data

describe('PrismaInboundFailureRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMock.mockResolvedValue({ id: 'failure-1' })
  })

  it('grava a falha e devolve o id', async () => {
    const id = await new PrismaInboundFailureRepository().create({
      jobId: 'job-1',
      source: 'hubmessage',
      type: 'message',
      traceKey: 'trace-1',
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
      instanceId: 'inst-1',
      errorCode: 'UNCLASSIFIED',
      errorMessage: 'falhou',
      attempts: 3,
      payload: { _id: 'm-1' },
    })

    expect(id).toBe('failure-1')
    expect(firstCreateData()).toMatchObject({
      jobId: 'job-1',
      source: 'hubmessage',
      attempts: 3,
      payload: { _id: 'm-1' },
      previousFailureId: null,
    })
  })

  it('campos opcionais ausentes viram nulo', async () => {
    await new PrismaInboundFailureRepository().create({
      jobId: 'job-2',
      source: 'z-api',
      type: '',
      errorCode: 'UNCLASSIFIED',
      errorMessage: 'x',
      attempts: 1,
      payload: {},
    })

    expect(firstCreateData()).toMatchObject({
      traceKey: null,
      domainId: null,
      domainName: null,
      instanceId: null,
      previousFailureId: null,
    })
  })

  it('liga a falha do reprocessado à falha anterior', async () => {
    await new PrismaInboundFailureRepository().create({
      jobId: 'reprocess-failure-1-1',
      source: 'hubmessage',
      type: 'message',
      errorCode: 'UNCLASSIFIED',
      errorMessage: 'x',
      attempts: 3,
      payload: {},
      previousFailureId: 'failure-1',
    })

    expect(firstCreateData().previousFailureId).toBe('failure-1')
  })

  describe('consulta e reprocesso', () => {
    const from = new Date('2026-11-06T00:00:00Z')
    const to = new Date('2026-11-13T00:00:00Z')
    const baseFilters = {
      statuses: ['FAILED', 'REPROCESSED'] as ('FAILED' | 'REPROCESSED')[],
      from,
      to,
      page: 2,
      limit: 20,
    }
    const dbRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'failure-1',
      jobId: 'job-1',
      source: 'hubmessage',
      type: 'message',
      traceKey: 'trace-1',
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
      instanceId: 'inst-1',
      errorCode: 'UNCLASSIFIED',
      errorMessage: 'falhou',
      attempts: 3,
      payload: { _id: 'm-1' },
      status: 'FAILED',
      reprocessCount: 0,
      lastReprocessedAt: null,
      lastReprocessedBy: null,
      previousFailureId: null,
      createdAt: new Date('2026-11-12T10:00:00Z'),
      ...overrides,
    })

    it('lista as mais recentes primeiro, paginada e restrita ao período', async () => {
      findManyMock.mockResolvedValue([dbRow()])
      countMock.mockResolvedValue(21)

      const result = await new PrismaInboundFailureRepository().list(
        baseFilters,
      )

      expect(findManyMock.mock.calls[0]![0]).toMatchObject({
        where: {
          status: { in: ['FAILED', 'REPROCESSED'] },
          createdAt: { gte: from, lte: to },
        },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 20,
      })
      expect(result.total).toBe(21)
      expect(result.items[0]).toMatchObject({
        id: 'failure-1',
        domainName: 'acme.bitrix24.com',
      })
    })

    /** `acme` não pode trazer `acme-filial`, como o filtro por trecho traria. */
    it('filtra pelo portal exato, pela origem e, na tela geral, pelo trecho do nome', async () => {
      findManyMock.mockResolvedValue([])
      countMock.mockResolvedValue(0)

      await new PrismaInboundFailureRepository().list({
        ...baseFilters,
        domainId: 'domain-1',
        domain: 'acme',
        source: 'hubmessage',
      })

      expect(findManyMock.mock.calls[0]![0]).toMatchObject({
        where: {
          domainId: 'domain-1',
          domainName: { contains: 'acme' },
          source: 'hubmessage',
        },
      })
    })

    it('findById devolve o registro, ou null quando não existe', async () => {
      findUniqueMock.mockResolvedValueOnce(dbRow({ reprocessCount: 2 }))
      findUniqueMock.mockResolvedValueOnce(null)
      const repo = new PrismaInboundFailureRepository()

      expect(await repo.findById('failure-1')).toMatchObject({
        id: 'failure-1',
        reprocessCount: 2,
      })
      expect(await repo.findById('x')).toBeNull()
    })

    it('reivindicar é condicional: só FAILED passa para REPROCESSED', async () => {
      updateManyMock.mockResolvedValue({ count: 1 })

      const ok = await new PrismaInboundFailureRepository().claimForReprocess(
        'failure-1',
        'user-1',
      )

      expect(ok).toBe(true)
      expect(updateManyMock.mock.calls[0]![0]).toMatchObject({
        where: { id: 'failure-1', status: 'FAILED' },
        data: {
          status: 'REPROCESSED',
          reprocessCount: { increment: 1 },
          lastReprocessedBy: 'user-1',
        },
      })
    })

    it('quem chega depois (ou em falha já reprocessada) não reivindica', async () => {
      updateManyMock.mockResolvedValue({ count: 0 })

      const ok = await new PrismaInboundFailureRepository().claimForReprocess(
        'failure-1',
        'user-2',
      )

      expect(ok).toBe(false)
    })

    it('desfazer devolve a falha a FAILED e o contador ao que era', async () => {
      updateManyMock.mockResolvedValue({ count: 1 })

      await new PrismaInboundFailureRepository().revertReprocess('failure-1')

      expect(updateManyMock.mock.calls[0]![0]).toMatchObject({
        where: { id: 'failure-1', status: 'REPROCESSED' },
        data: { status: 'FAILED', reprocessCount: { decrement: 1 } },
      })
    })

    it('expurgo: apaga em lote só o que passou do corte', async () => {
      const cutoff = new Date('2026-11-06T00:00:00Z')
      findManyMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
      deleteManyMock.mockResolvedValue({ count: 2 })
      const repo = new PrismaInboundFailureRepository()

      expect(await repo.deleteExpiredBatch(cutoff, 100)).toBe(2)
      expect(findManyMock.mock.calls[0]![0]).toMatchObject({
        where: { createdAt: { lt: cutoff } },
        take: 100,
      })
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] } },
      })
    })

    it('expurgo sem vencidos não apaga nada', async () => {
      findManyMock.mockResolvedValue([])

      expect(
        await new PrismaInboundFailureRepository().deleteExpiredBatch(
          new Date(),
          100,
        ),
      ).toBe(0)
      expect(deleteManyMock).not.toHaveBeenCalled()
    })

    it('e-mail de quem reprocessou, ou null quando o usuário sumiu', async () => {
      portalUserFindUniqueMock.mockResolvedValueOnce({
        email: 'suporte@crmthink.com',
      })
      portalUserFindUniqueMock.mockResolvedValueOnce(null)
      const repo = new PrismaInboundFailureRepository()

      expect(await repo.portalUserEmail('user-1')).toBe('suporte@crmthink.com')
      expect(await repo.portalUserEmail('user-x')).toBeNull()
    })
  })
})
