import { describe, expect, it, vi } from 'vitest'
import { GetPortalDomainDetail } from './get-portal-domain-detail'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import { PortalDomainNotFoundError } from '../domain/errors/portal-domain.errors'

const sampleDomain = {
  id: 'domain-1',
  name: 'empresa.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  apps: [],
}

describe('GetPortalDomainDetail', () => {
  it('returns domain when found', async () => {
    const findById = vi.fn().mockResolvedValue(sampleDomain)
    const portalDomainReadRepository: PortalDomainReadRepository = {
      listAll: vi.fn(),
      findById,
    }

    const useCase = new GetPortalDomainDetail(portalDomainReadRepository)
    const result = await useCase.execute('domain-1')

    expect(result).toEqual(sampleDomain)
    expect(findById).toHaveBeenCalledWith('domain-1')
  })

  it('throws when domain is not found', async () => {
    const portalDomainReadRepository: PortalDomainReadRepository = {
      listAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    }

    const useCase = new GetPortalDomainDetail(portalDomainReadRepository)

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(
      PortalDomainNotFoundError,
    )
  })
})
