import { describe, expect, it, vi } from 'vitest'
import { GetPortalDomainController } from './get-domain-controller'
import { GetPortalDomainDetail } from '../../application/get-portal-domain-detail'
import { PortalDomainNotFoundError } from '../../domain/errors/portal-domain.errors'

const sampleDomain = {
  id: 'domain-1',
  name: 'empresa.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  apps: [],
}

describe('GetPortalDomainController', () => {
  it('returns 404 when domain is not found', async () => {
    const getPortalDomainDetail = {
      execute: vi.fn().mockRejectedValue(new PortalDomainNotFoundError()),
    } as unknown as GetPortalDomainDetail

    const controller = new GetPortalDomainController(getPortalDomainDetail)
    const response = await controller.perform(
      { params: { id: 'missing-id' } } as never,
      {} as never,
    )

    expect(response.status).toBe(404)
    expect(response.result).toEqual({ error: 'Domain not found' })
  })

  it('returns 200 with domain data', async () => {
    const getPortalDomainDetail = {
      execute: vi.fn().mockResolvedValue(sampleDomain),
    } as unknown as GetPortalDomainDetail

    const controller = new GetPortalDomainController(getPortalDomainDetail)
    const response = await controller.perform(
      { params: { id: 'domain-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual(sampleDomain)
  })
})
