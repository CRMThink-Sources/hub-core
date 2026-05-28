import { describe, expect, it, vi } from 'vitest'
import { ListPortalDomains } from './list-portal-domains'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'

const sampleDomain = {
  id: 'domain-1',
  name: 'empresa.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  apps: [
    {
      id: 'app-1',
      appCode: 'thinkzap',
      appName: 'ThinkZap',
      status: 'ACTIVE',
      email: 'admin@empresa.com',
      installedAt: '2026-01-01T12:00:00.000Z',
    },
  ],
}

describe('ListPortalDomains', () => {
  it('returns domains and total', async () => {
    const listAll = vi.fn().mockResolvedValue([sampleDomain])
    const portalDomainReadRepository: PortalDomainReadRepository = {
      listAll,
      findById: vi.fn(),
    }

    const useCase = new ListPortalDomains(portalDomainReadRepository)
    const result = await useCase.execute()

    expect(result.domains).toEqual([sampleDomain])
    expect(result.total).toBe(1)
    expect(listAll).toHaveBeenCalledOnce()
  })

  it('returns empty list when no domains exist', async () => {
    const portalDomainReadRepository: PortalDomainReadRepository = {
      listAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
    }

    const useCase = new ListPortalDomains(portalDomainReadRepository)
    const result = await useCase.execute()

    expect(result.domains).toEqual([])
    expect(result.total).toBe(0)
  })
})
