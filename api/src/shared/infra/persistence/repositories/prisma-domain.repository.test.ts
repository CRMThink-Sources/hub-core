import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock, findUniqueMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findUniqueMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: { domain: { upsert: upsertMock, findUnique: findUniqueMock } },
}))

import { PrismaDomainRepository } from './prisma-domain.repository'
import { MemberIdAlreadyLinkedError } from '@/shared/domain/errors/member-id-already-linked.error'

const row = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-30T00:00:00.000Z'),
}

function uniqueViolation(target: string[]) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  })
}

describe('PrismaDomainRepository.upsertDomain', () => {
  beforeEach(() => {
    upsertMock.mockReset()
    findUniqueMock.mockReset()
  })

  it('cria o domínio quando o portal é novo', async () => {
    upsertMock.mockResolvedValue(row)

    const result = await new PrismaDomainRepository().upsertDomain({
      name: 'acme.bitrix24.com.br',
      memberId: 'member-1',
    })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'acme.bitrix24.com.br' },
        update: { memberId: 'member-1' },
      }),
    )
    expect(result).toEqual(row)
  })

  it('atualiza o member_id preservando o id do domínio', async () => {
    upsertMock.mockResolvedValue({ ...row, memberId: 'member-2' })

    const result = await new PrismaDomainRepository().upsertDomain({
      name: 'acme.bitrix24.com.br',
      memberId: 'member-2',
    })

    const call = upsertMock.mock.calls[0]?.[0] as {
      create: object
      update: object
    }
    expect(call.update).toEqual({ memberId: 'member-2' })
    expect(call.create).not.toHaveProperty('id', 'domain-1')
    expect(result.id).toBe('domain-1')
    expect(result.memberId).toBe('member-2')
  })

  it('traduz violação de unicidade de member_id em erro nomeado, com o dono', async () => {
    upsertMock.mockRejectedValue(uniqueViolation(['member_id']))
    findUniqueMock.mockResolvedValue({ ...row, name: 'outro.bitrix24.com.br' })

    const promise = new PrismaDomainRepository().upsertDomain({
      name: 'acme.bitrix24.com.br',
      memberId: 'member-1',
    })

    await expect(promise).rejects.toBeInstanceOf(MemberIdAlreadyLinkedError)
    await expect(promise).rejects.toThrow('outro.bitrix24.com.br')
  })

  it('não mascara violação de unicidade de outro índice', async () => {
    const error = uniqueViolation(['name'])
    upsertMock.mockRejectedValue(error)

    await expect(
      new PrismaDomainRepository().upsertDomain({
        name: 'acme.bitrix24.com.br',
        memberId: 'member-1',
      }),
    ).rejects.toBe(error)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('não mascara erro que não é P2002', async () => {
    const error = new Error('connection lost')
    upsertMock.mockRejectedValue(error)

    await expect(
      new PrismaDomainRepository().upsertDomain({
        name: 'acme.bitrix24.com.br',
        memberId: 'member-1',
      }),
    ).rejects.toBe(error)
  })
})
