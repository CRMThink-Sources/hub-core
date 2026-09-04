import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, updateMock, findUniqueMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
  findUniqueMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    credential: {
      findMany: findManyMock,
      update: updateMock,
      findUnique: findUniqueMock,
    },
  },
}))

import { PrismaCredentialRepository } from './prisma-credential.repository'

const sut = () => new PrismaCredentialRepository()

type FindManyArgs = { where: Record<string, unknown> }
type UpdateArgs = { data: Record<string, unknown> }

describe('PrismaCredentialRepository', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    updateMock.mockReset()
    findUniqueMock.mockReset()
  })

  describe('listExpired', () => {
    it('filtra por vencida E por dentro do limite de tentativas', async () => {
      findManyMock.mockResolvedValue([])
      const buffer = new Date('2026-09-04T12:00:00.000Z')

      await sut().listExpired(buffer, 5)

      const args = findManyMock.mock.calls[0]![0] as FindManyArgs
      expect(args.where).toEqual({
        expiresAt: { lte: buffer },
        refreshFailedAttempts: { lt: 5 },
      })
    })

    it('mapeia refreshFailedAttempts da row pro domínio', async () => {
      findManyMock.mockResolvedValue([
        {
          id: 'cred-1',
          appId: 'app-1',
          accessToken: 'at',
          refreshToken: 'rt',
          expiresAt: new Date('2026-09-04T12:00:00.000Z'),
          refreshFailedAttempts: 3,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          app: { appCode: { code: 'client-1', secret: 'secret-1' } },
        },
      ])

      const [credential] = await sut().listExpired(new Date(), 5)

      expect(credential!.refreshFailedAttempts).toBe(3)
    })
  })

  describe('update', () => {
    it('zera refreshFailedAttempts sempre que grava tokens novos', async () => {
      updateMock.mockResolvedValue({
        id: 'cred-1',
        appId: 'app-1',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        accessToken: 'at-novo',
        refreshToken: 'rt-novo',
        expiresAt: new Date('2026-09-04T12:00:00.000Z'),
        refreshFailedAttempts: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })

      await sut().update({
        appId: 'app-1',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        accessToken: 'at-novo',
        refreshToken: 'rt-novo',
        expiresAt: new Date('2026-09-04T12:00:00.000Z'),
      })

      const args = updateMock.mock.calls[0]![0] as UpdateArgs
      expect(args.data.refreshFailedAttempts).toBe(0)
    })
  })

  describe('recordFailure', () => {
    it('incrementa atomicamente e devolve o total atualizado', async () => {
      updateMock.mockResolvedValue({ refreshFailedAttempts: 4 })

      const result = await sut().recordFailure('app-1')

      expect(updateMock).toHaveBeenCalledWith({
        where: { appId: 'app-1' },
        data: { refreshFailedAttempts: { increment: 1 } },
        select: { refreshFailedAttempts: true },
      })
      expect(result).toEqual({ attempts: 4 })
    })
  })
})
