import { beforeEach, describe, expect, it, vi } from 'vitest'

const { aggregateMock, createMock, findManyMock, deleteManyMock, warnMock } =
  vi.hoisted(() => ({
    aggregateMock: vi.fn(),
    createMock: vi.fn(),
    findManyMock: vi.fn(),
    deleteManyMock: vi.fn(),
    warnMock: vi.fn(),
  }))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapDeliveryAttempt: {
      aggregate: aggregateMock,
      create: createMock,
      findMany: findManyMock,
      deleteMany: deleteManyMock,
    },
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: warnMock, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  MAX_ATTEMPT_MESSAGE_LENGTH,
  PrismaDeliveryAttemptRepository,
} from './prisma-delivery-attempt.repository'

const OUTBOX = { kind: 'OUTBOX', id: 'outbox-1' } as const

/** O `data` da primeira gravação, tipado: `mock.calls` devolve `any`. */
const firstCreateData = () =>
  (createMock.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data

describe('PrismaDeliveryAttemptRepository', () => {
  const repo = new PrismaDeliveryAttemptRepository()

  beforeEach(() => {
    vi.clearAllMocks()
    createMock.mockResolvedValue({})
  })

  describe('recordFailure', () => {
    it('numera a primeira tentativa do item como 1', async () => {
      aggregateMock.mockResolvedValue({ _max: { attempt: null } })

      await repo.recordFailure(OUTBOX, {
        errorCode: 'thinkzap.message.widget_send_exhausted',
        message: 'Provider recusou',
        durationMs: 120,
      })

      expect(createMock).toHaveBeenCalledWith({
        data: {
          refKind: 'OUTBOX',
          refId: 'outbox-1',
          attempt: 1,
          errorCode: 'thinkzap.message.widget_send_exhausted',
          message: 'Provider recusou',
          indeterminate: false,
          durationMs: 120,
        },
      })
    })

    /** Depois do reprocessamento a numeração segue a anterior (spec: "aparece como 5"). */
    it('continua a numeração depois de um reprocessamento', async () => {
      aggregateMock.mockResolvedValue({ _max: { attempt: 4 } })

      await repo.recordFailure(OUTBOX, {
        errorCode: 'UNCLASSIFIED',
        message: 'falhou de novo',
      })

      expect(firstCreateData()).toMatchObject({ attempt: 5 })
    })

    it('marca a tentativa indeterminada e deixa a duração nula quando ausente', async () => {
      aggregateMock.mockResolvedValue({ _max: { attempt: 2 } })

      await repo.recordFailure(OUTBOX, {
        errorCode: 'thinkzap.message.widget_send_unknown',
        message: 'timeout',
        indeterminate: true,
      })

      expect(firstCreateData()).toMatchObject({
        indeterminate: true,
        durationMs: null,
      })
    })

    it('corta mensagens enormes no teto', async () => {
      aggregateMock.mockResolvedValue({ _max: { attempt: null } })

      await repo.recordFailure(OUTBOX, {
        errorCode: 'UNCLASSIFIED',
        message: 'x'.repeat(MAX_ATTEMPT_MESSAGE_LENGTH + 500),
      })

      expect(firstCreateData().message).toHaveLength(MAX_ATTEMPT_MESSAGE_LENGTH)
    })

    /** A gravação do log nunca pode mudar o desfecho do envio. */
    it('engole o erro do banco e só avisa no log', async () => {
      aggregateMock.mockResolvedValue({ _max: { attempt: null } })
      createMock.mockRejectedValue(new Error('banco fora'))

      await expect(
        repo.recordFailure(OUTBOX, { errorCode: 'UNCLASSIFIED', message: 'x' }),
      ).resolves.toBeUndefined()

      expect(warnMock).toHaveBeenCalledTimes(1)
    })

    it('engole também a falha na leitura da numeração', async () => {
      aggregateMock.mockRejectedValue(new Error('banco fora'))

      await expect(
        repo.recordFailure(OUTBOX, { errorCode: 'UNCLASSIFIED', message: 'x' }),
      ).resolves.toBeUndefined()

      expect(createMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteExpiredBatch', () => {
    const cutoff = new Date('2026-11-06T00:00:00Z')

    it('apaga só os vencidos, em lote, pelos ids selecionados', async () => {
      findManyMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
      deleteManyMock.mockResolvedValue({ count: 2 })

      const count = await repo.deleteExpiredBatch(cutoff, 500)

      expect(count).toBe(2)
      expect(findManyMock).toHaveBeenCalledWith({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] } },
      })
    })

    it('sem vencidos não apaga nada', async () => {
      findManyMock.mockResolvedValue([])

      expect(await repo.deleteExpiredBatch(cutoff, 500)).toBe(0)
      expect(deleteManyMock).not.toHaveBeenCalled()
    })
  })

  describe('listByRef', () => {
    it('lista em ordem cronológica, só do item pedido', async () => {
      const createdAt = new Date('2026-11-13T10:00:00Z')
      findManyMock.mockResolvedValue([
        {
          id: 'a1',
          attempt: 1,
          errorCode: 'UNCLASSIFIED',
          message: 'm',
          indeterminate: false,
          durationMs: 10,
          createdAt,
          refKind: 'INBOUND',
          refId: 'job-9',
        },
      ])

      const result = await repo.listByRef({ kind: 'INBOUND', id: 'job-9' })

      expect(findManyMock).toHaveBeenCalledWith({
        where: { refKind: 'INBOUND', refId: 'job-9' },
        orderBy: [{ attempt: 'asc' }, { createdAt: 'asc' }],
      })
      expect(result).toEqual([
        {
          id: 'a1',
          attempt: 1,
          errorCode: 'UNCLASSIFIED',
          message: 'm',
          indeterminate: false,
          durationMs: 10,
          createdAt,
        },
      ])
    })
  })
})
