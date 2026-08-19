import { describe, expect, it, vi } from 'vitest'
import { ListPortalDomains } from './list-portal-domains'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'

const app = (id: string, spaId: string | null) => ({
  id,
  appCodeId: 'crmthink.thinkzap',
  appCode: 'thinkzap',
  appName: 'ThinkZap',
  title: 'ThinkZap',
  spaId,
  status: 'ACTIVE',
  email: 'admin@empresa.com',
  installedAt: '2026-01-01T12:00:00.000Z',
})

const domainWith = (apps: ReturnType<typeof app>[]) => ({
  id: 'domain-1',
  name: 'empresa.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  apps,
})

const repository = (domains: unknown[]): PortalDomainReadRepository => ({
  listAll: vi.fn().mockResolvedValue(domains),
  findById: vi.fn(),
})

describe('ListPortalDomains', () => {
  it('sobrescreve o título com o do espelho da SPA', async () => {
    const getTitlesBySpaIds = vi
      .fn()
      .mockResolvedValue(new Map([['1060-1', 'ThinkZap — Matriz']]))

    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      { getTitlesBySpaIds },
    )

    const result = await useCase.execute()

    expect(getTitlesBySpaIds).toHaveBeenCalledWith(['1060-1'])
    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap — Matriz')
    expect(result.total).toBe(1)
  })

  it('cai para o nome do app quando o id não vem no Map', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      { getTitlesBySpaIds: vi.fn().mockResolvedValue(new Map()) },
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
  })

  it('não consulta o CRM quando nenhum app tem espelho', async () => {
    const getTitlesBySpaIds = vi.fn()

    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', null)])]),
      { getTitlesBySpaIds },
    )

    const result = await useCase.execute()

    expect(getTitlesBySpaIds).not.toHaveBeenCalled()
    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
  })

  it('degrada para o nome do app quando a leitura de títulos falha', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      {
        getTitlesBySpaIds: vi.fn().mockRejectedValue(new Error('bitrix fora')),
      },
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
  })

  it('não resolve contrato na listagem', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      { getTitlesBySpaIds: vi.fn().mockResolvedValue(new Map()) },
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]).not.toHaveProperty('contract')
  })

  it('devolve lista vazia quando não há domínio', async () => {
    const useCase = new ListPortalDomains(repository([]), {
      getTitlesBySpaIds: vi.fn(),
    })

    const result = await useCase.execute()

    expect(result).toEqual({ domains: [], total: 0 })
  })
})
