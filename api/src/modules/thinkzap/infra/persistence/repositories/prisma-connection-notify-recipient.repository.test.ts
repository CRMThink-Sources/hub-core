import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, deleteManyMock, createManyMock, transactionMock } =
  vi.hoisted(() => ({
    findManyMock: vi.fn(),
    deleteManyMock: vi.fn(),
    createManyMock: vi.fn(),
    transactionMock: vi.fn(),
  }))

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    thinkzapConnectionNotifyRecipient: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      createMany: createManyMock,
    },
    $transaction: transactionMock,
  },
}))

import { PrismaConnectionNotifyRecipientRepository } from './prisma-connection-notify-recipient.repository'

describe('PrismaConnectionNotifyRecipientRepository', () => {
  const repo = new PrismaConnectionNotifyRecipientRepository()

  beforeEach(() => {
    vi.clearAllMocks()
    transactionMock.mockResolvedValue(undefined)
  })

  describe('listByAppId', () => {
    it('retorna os bitrixUserId da app', async () => {
      findManyMock.mockResolvedValue([
        { bitrixUserId: 111 },
        { bitrixUserId: 222 },
      ])

      const result = await repo.listByAppId('app-1')

      expect(findManyMock).toHaveBeenCalledWith({
        where: { appId: 'app-1' },
        select: { bitrixUserId: true },
      })
      expect(result).toEqual([111, 222])
    })
  })

  describe('replaceAll', () => {
    it('apaga a lista anterior e insere a nova, deduplicada', async () => {
      const result = await repo.replaceAll('app-1', [111, 222, 111])

      expect(deleteManyMock).toHaveBeenCalledWith({ where: { appId: 'app-1' } })
      expect(createManyMock).toHaveBeenCalledWith({
        data: [
          { id: expect.any(String), appId: 'app-1', bitrixUserId: 111 },
          { id: expect.any(String), appId: 'app-1', bitrixUserId: 222 },
        ],
      })
      expect(transactionMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual([111, 222])
    })

    it('lista vazia só apaga, sem chamar createMany', async () => {
      const result = await repo.replaceAll('app-1', [])

      expect(deleteManyMock).toHaveBeenCalledWith({ where: { appId: 'app-1' } })
      expect(createManyMock).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })
})
