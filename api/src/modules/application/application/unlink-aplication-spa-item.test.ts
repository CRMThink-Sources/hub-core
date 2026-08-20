import { describe, expect, it, vi } from 'vitest'
import { UnlinkAplicationSpaItem } from './unlink-aplication-spa-item'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const aplication = (spaId: string | null): Aplication => ({
  id: 'app-1',
  spaId,
  customer: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'crmthink.thinkzap',
  title: 'ThinkersZap',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
})

const makeRepo = (found: Aplication | null) => {
  const getAplicationBySpaId = vi.fn(() => Promise.resolve(found))
  const unlinkSpaItem = vi.fn(() => Promise.resolve(aplication(null)))

  return {
    repo: {
      getAplicationBySpaId,
      unlinkSpaItem,
    } as unknown as AplicationRepository,
    getAplicationBySpaId,
    unlinkSpaItem,
  }
}

describe('UnlinkAplicationSpaItem', () => {
  it('desvincula a instalação resolvida pelo id do item', async () => {
    const { repo, getAplicationBySpaId, unlinkSpaItem } = makeRepo(
      aplication('512'),
    )

    await new UnlinkAplicationSpaItem(repo).execute('512')

    expect(getAplicationBySpaId).toHaveBeenCalledWith('512')
    expect(unlinkSpaItem).toHaveBeenCalledWith('app-1')
  })

  it('não escreve quando o item não espelha instalação nenhuma', async () => {
    const { repo, unlinkSpaItem } = makeRepo(null)

    await new UnlinkAplicationSpaItem(repo).execute('999')

    expect(unlinkSpaItem).not.toHaveBeenCalled()
  })

  it('propaga a falha da escrita para quem despachou registrar', async () => {
    const { repo, unlinkSpaItem } = makeRepo(aplication('512'))
    unlinkSpaItem.mockRejectedValueOnce(new Error('db down'))

    await expect(
      new UnlinkAplicationSpaItem(repo).execute('512'),
    ).rejects.toThrow('db down')
  })
})
