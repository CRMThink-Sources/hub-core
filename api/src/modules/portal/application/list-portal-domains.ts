import type { PortalDomainDetail } from '../domain/entities/portal-domain'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'

export type ListPortalDomainsResult = {
  domains: PortalDomainDetail[]
  total: number
}

export class ListPortalDomains {
  constructor(
    private readonly portalDomainReadRepository: PortalDomainReadRepository,
  ) {}

  async execute(): Promise<ListPortalDomainsResult> {
    const domains = await this.portalDomainReadRepository.listAll()

    return {
      domains,
      total: domains.length,
    }
  }
}
