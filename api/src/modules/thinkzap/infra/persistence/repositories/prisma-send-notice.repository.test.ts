import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  upsertMock,
  findUniqueMock,
  findManyMock,
  updateMock,
  updateManyMock,
  deleteManyMock,
} = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
  updateManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapSendNotice: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
      findMany: findManyMock,
      update: updateMock,
      updateMany: updateManyMock,
      deleteMany: deleteManyMock,
    },
  },
}))

import { PrismaSendNoticeRepository } from './prisma-send-notice.repository'

const sut = () => new PrismaSendNoticeRepository()

const at = new Date('2026-11-27T12:00:00.000Z')

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'notice-1',
  dispatchKey: 'group-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  entity: 'deal',
  entityId: '42',
  operatorBitrixUserId: '7',
  eager: false,
  commentId: null,
  commentAsAuthor: false,
  commentClaimedAt: null,
  fromPhone: null,
  alertedFailures: 0,
  createdAt: at,
  updatedAt: at,
  ...overrides,
})

const input = {
  dispatchKey: 'group-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  entity: 'deal',
  entityId: '42',
  operatorBitrixUserId: '7',
}

describe('PrismaSendNoticeRepository', () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue(dbRow())
    findUniqueMock.mockReset().mockResolvedValue(null)
    findManyMock.mockReset().mockResolvedValue([])
    updateMock.mockReset().mockResolvedValue(dbRow())
    updateManyMock.mockReset().mockResolvedValue({ count: 1 })
    deleteManyMock.mockReset().mockResolvedValue({ count: 0 })
  })

  it('cria pelo dispatchKey sem sobrescrever o aviso existente', async () => {
    const record = await sut().ensure(input)

    expect(upsertMock).toHaveBeenCalledWith({
      where: { dispatchKey: 'group-1' },
      create: input,
      update: {},
    })
    expect(record).toEqual(dbRow())
  })

  it('grava o aviso como imediato quando pedido', async () => {
    await sut().ensure({ ...input, eager: true })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ create: { ...input, eager: true } }),
    )
  })

  it('relê o aviso quando outra parte do grupo o criou na corrida', async () => {
    upsertMock.mockRejectedValue({ code: 'P2002' })
    findUniqueMock.mockResolvedValue(dbRow({ id: 'notice-vencedor' }))

    const record = await sut().ensure(input)

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { dispatchKey: 'group-1' },
    })
    expect(record.id).toBe('notice-vencedor')
  })

  it('propaga o P2002 quando a releitura não acha o aviso', async () => {
    const error = { code: 'P2002' }
    upsertMock.mockRejectedValue(error)

    await expect(sut().ensure(input)).rejects.toBe(error)
  })

  it('não mascara erro que não é P2002', async () => {
    const error = new Error('conexão perdida')
    upsertMock.mockRejectedValue(error)

    await expect(sut().ensure(input)).rejects.toBe(error)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('busca o aviso pelo id', async () => {
    findUniqueMock.mockResolvedValue(dbRow())

    await expect(sut().findById('notice-1')).resolves.toEqual(dbRow())
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
    })
  })

  it('devolve null quando o aviso não existe', async () => {
    await expect(sut().findById('notice-1')).resolves.toBeNull()
  })

  it('reivindica o comentário só se ninguém reivindicou', async () => {
    await expect(sut().claimComment('notice-1', at)).resolves.toBe(true)

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'notice-1', commentClaimedAt: null },
      data: { commentClaimedAt: at },
    })
  })

  it('devolve false para quem perde a reivindicação', async () => {
    updateManyMock.mockResolvedValue({ count: 0 })

    await expect(sut().claimComment('notice-1', at)).resolves.toBe(false)
  })

  it('grava o comentário publicado e a autoria', async () => {
    await sut().saveComment('notice-1', { commentId: '99', asAuthor: true })

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: { commentId: '99', commentAsAuthor: true },
    })
  })

  it('grava o telefone de origem', async () => {
    await sut().saveFromPhone('notice-1', '5511999999999')

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: { fromPhone: '5511999999999' },
    })
  })

  it('grava quantas falhas já foram avisadas', async () => {
    await sut().saveAlerted('notice-1', 3)

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: { alertedFailures: 3 },
    })
  })

  it('expurga em lote os avisos anteriores ao corte', async () => {
    findManyMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    deleteManyMock.mockResolvedValue({ count: 2 })

    await expect(sut().deleteExpiredBatch(at, 100)).resolves.toBe(2)

    expect(findManyMock).toHaveBeenCalledWith({
      where: { createdAt: { lt: at } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
    })
  })

  it('não apaga nada quando não há aviso vencido', async () => {
    await expect(sut().deleteExpiredBatch(at, 100)).resolves.toBe(0)
    expect(deleteManyMock).not.toHaveBeenCalled()
  })
})
