import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, findManyMock, upsertMock, deleteMock } = vi.hoisted(
  () => ({
    findUniqueMock: vi.fn(),
    findManyMock: vi.fn(),
    upsertMock: vi.fn(),
    deleteMock: vi.fn(),
  }),
)

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    productUpdate: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      upsert: upsertMock,
      delete: deleteMock,
    },
  },
}))

import { Prisma } from '@/prisma/client'
import { TaskAlreadyLinkedError } from '../../domain/errors/product-update.errors'
import {
  buildProductUpdate,
  completeProductUpdateContent,
} from './in-memory-product-update.repository.fake'
import { PrismaProductUpdateRepository } from './prisma-product-update.repository'

const published = buildProductUpdate({
  visibility: 'PUBLISHED',
  content: completeProductUpdateContent('product-updates/a.png'),
  publishedContent: completeProductUpdateContent(),
  bitrixTaskId: 901,
})

/** Linha como o Prisma devolve: o JSON vem cru, sem defaults. */
const rowOf = (overrides: Record<string, unknown> = {}) => ({
  ...published,
  content: { pt: { title: 'Só pt' } },
  publishedContent: null,
  ...overrides,
})

function uniqueViolation(target?: string[] | string) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: target === undefined ? {} : { target },
  })
}

describe('PrismaProductUpdateRepository', () => {
  const repo = new PrismaProductUpdateRepository()

  beforeEach(() => vi.clearAllMocks())

  it('findById passa o JSON pelo schema do conteúdo', async () => {
    findUniqueMock.mockResolvedValue(rowOf())

    const found = await repo.findById('pu-1')

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'pu-1' } })
    expect(found?.content).toEqual({
      pt: { title: 'Só pt', description: '' },
      en: { title: '', description: '' },
      es: { title: '', description: '' },
      imageKey: null,
    })
    expect(found?.publishedContent).toBeNull()
  })

  it('findById devolve null sem registro', async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(await repo.findById('x')).toBeNull()
  })

  it('findByBitrixTaskId usa o índice único', async () => {
    findUniqueMock.mockResolvedValue(rowOf())

    await repo.findByBitrixTaskId(901)

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { bitrixTaskId: 901 },
    })
  })

  it('list ordena das mais recentes', async () => {
    findManyMock.mockResolvedValue([rowOf()])

    const result = await repo.list()

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toHaveLength(1)
  })

  it('listReconcilable: com tarefa e sem data de disponibilidade', async () => {
    findManyMock.mockResolvedValue([])

    await repo.listReconcilable()

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bitrixTaskId: { not: null }, availableAt: null },
      }),
    )
  })

  it('save faz upsert pelo id com o conteúdo e o snapshot em JSON', async () => {
    upsertMock.mockResolvedValue(
      rowOf({
        content: published.content,
        publishedContent: published.publishedContent,
      }),
    )

    const saved = await repo.save(published)

    const call = upsertMock.mock.calls[0]?.[0] as {
      where: unknown
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(call.where).toEqual({ id: 'pu-1' })
    expect(call.create).toMatchObject({
      id: 'pu-1',
      createdAt: published.createdAt,
      content: published.content,
      publishedContent: published.publishedContent,
      bitrixTaskId: 901,
      visibility: 'PUBLISHED',
    })
    expect(call.update).not.toHaveProperty('id')
    expect(call.update).not.toHaveProperty('updatedAt')
    expect(saved.content).toEqual(published.content)
  })

  it('save grava snapshot ausente como NULL do banco', async () => {
    const draft = buildProductUpdate()
    upsertMock.mockResolvedValue(rowOf({ publishedContent: null }))

    await repo.save(draft)

    const call = upsertMock.mock.calls[0]?.[0] as {
      update: { publishedContent: unknown }
    }
    expect(call.update.publishedContent).toBe(Prisma.DbNull)
  })

  it.each([
    ['com target', ['bitrix_task_id']],
    ['com o nome do índice', 'thinkzap_product_updates_bitrix_task_id_key'],
    ['sem target', undefined],
  ])(
    'violação de unicidade da tarefa (%s) vira TaskAlreadyLinkedError com a dona',
    async (_, target) => {
      upsertMock.mockRejectedValue(uniqueViolation(target))
      findUniqueMock.mockResolvedValue(rowOf({ id: 'pu-dona' }))

      const error: unknown = await repo.save(published).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TaskAlreadyLinkedError)
      expect(error).toMatchObject({ taskId: 901, productUpdateId: 'pu-dona' })
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { bitrixTaskId: 901 },
      })
    },
  )

  it('não mascara P2002 de outro índice', async () => {
    const error = uniqueViolation(['PRIMARY'])
    upsertMock.mockRejectedValue(error)

    await expect(repo.save(published)).rejects.toBe(error)
  })

  it('não mascara erro que não é P2002', async () => {
    const error = new Error('connection lost')
    upsertMock.mockRejectedValue(error)

    await expect(repo.save(published)).rejects.toBe(error)
  })

  it('delete pelo id', async () => {
    deleteMock.mockResolvedValue({})

    await repo.delete('pu-1')

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'pu-1' } })
  })
})
