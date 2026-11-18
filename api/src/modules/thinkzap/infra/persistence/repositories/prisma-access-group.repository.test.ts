import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  lineFindMany: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    thinkzapAccessGroup: {
      findMany: m.findMany,
      findFirst: m.findFirst,
      create: m.create,
      update: m.update,
      deleteMany: m.deleteMany,
    },
    thinkzapAccessGroupLine: { findMany: m.lineFindMany },
  },
}))

import { AccessGroupNameTakenError } from '@/modules/thinkzap/domain/errors/access-group-name-taken.error'
import { AccessGroupNotFoundError } from '@/modules/thinkzap/domain/errors/access-group-not-found.error'
import { PrismaAccessGroupRepository } from './prisma-access-group.repository'

type NestedData = {
  members: { create?: unknown; deleteMany?: unknown }
  lines: { create?: unknown; deleteMany?: unknown }
}

const now = new Date('2026-11-19T00:00:00Z')
const row = {
  id: 'g1',
  appId: 'app-1',
  name: 'Vendas',
  createdAt: now,
  updatedAt: now,
  members: [{ bitrixUserId: '7' }],
  lines: [{ subscriptionItemId: '100' }],
}

describe('PrismaAccessGroupRepository', () => {
  const repo = new PrismaAccessGroupRepository()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista os grupos da instalação mapeando membros e linhas', async () => {
    m.findMany.mockResolvedValue([row])

    const result = await repo.list('app-1')

    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appId: 'app-1' } }),
    )
    expect(result).toEqual([
      {
        id: 'g1',
        appId: 'app-1',
        name: 'Vendas',
        memberIds: ['7'],
        lineIds: ['100'],
        createdAt: now,
        updatedAt: now,
      },
    ])
  })

  it('hasAny reflete a existência de grupos', async () => {
    m.findFirst.mockResolvedValueOnce({ id: 'g1' })
    expect(await repo.hasAny('app-1')).toBe(true)
    m.findFirst.mockResolvedValueOnce(null)
    expect(await repo.hasAny('app-1')).toBe(false)
  })

  it('devolve a união deduplicada das linhas dos grupos do usuário', async () => {
    m.lineFindMany.mockResolvedValue([
      { subscriptionItemId: '1' },
      { subscriptionItemId: '2' },
      { subscriptionItemId: '1' },
    ])

    const result = await repo.listLineIdsForUser('app-1', '7')

    expect(m.lineFindMany).toHaveBeenCalledWith({
      where: {
        group: { appId: 'app-1', members: { some: { bitrixUserId: '7' } } },
      },
      select: { subscriptionItemId: true },
    })
    expect(result).toEqual(['1', '2'])
  })

  it('create deduplica membros e linhas', async () => {
    m.create.mockResolvedValue(row)

    await repo.create('app-1', {
      name: 'Vendas',
      memberIds: ['7', '7'],
      lineIds: ['100', '100'],
    })

    const data = (m.create.mock.calls[0]?.[0] as { data: NestedData }).data
    expect(data.members.create).toEqual([{ bitrixUserId: '7' }])
    expect(data.lines.create).toEqual([{ subscriptionItemId: '100' }])
  })

  it('create traduz violação do índice único em nome já usado', async () => {
    m.create.mockRejectedValue({ code: 'P2002' })

    await expect(
      repo.create('app-1', { name: 'Vendas', memberIds: [], lineIds: [] }),
    ).rejects.toBeInstanceOf(AccessGroupNameTakenError)
  })

  it('update recusa grupo de outra instalação', async () => {
    m.findFirst.mockResolvedValue(null)

    await expect(
      repo.update('app-1', 'g1', { name: 'X', memberIds: [], lineIds: [] }),
    ).rejects.toBeInstanceOf(AccessGroupNotFoundError)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('update substitui membros e linhas', async () => {
    m.findFirst.mockResolvedValue({ id: 'g1' })
    m.update.mockResolvedValue(row)

    await repo.update('app-1', 'g1', {
      name: 'Vendas',
      memberIds: ['7'],
      lineIds: ['100'],
    })

    const data = (m.update.mock.calls[0]?.[0] as { data: NestedData }).data
    expect(data.members.deleteMany).toEqual({})
    expect(data.lines.deleteMany).toEqual({})
  })

  it('update traduz nome duplicado', async () => {
    m.findFirst.mockResolvedValue({ id: 'g1' })
    m.update.mockRejectedValue({ code: 'P2002' })

    await expect(
      repo.update('app-1', 'g1', { name: 'X', memberIds: [], lineIds: [] }),
    ).rejects.toBeInstanceOf(AccessGroupNameTakenError)
  })

  it('remove filtra pela instalação e informa se apagou', async () => {
    m.deleteMany.mockResolvedValueOnce({ count: 1 })
    expect(await repo.remove('app-1', 'g1')).toBe(true)
    expect(m.deleteMany).toHaveBeenCalledWith({
      where: { id: 'g1', appId: 'app-1' },
    })
    m.deleteMany.mockResolvedValueOnce({ count: 0 })
    expect(await repo.remove('app-1', 'g1')).toBe(false)
  })
})
