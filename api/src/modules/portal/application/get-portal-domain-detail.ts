import type { PortalDomainDetail } from '../domain/entities/portal-domain'
import { PortalDomainNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'

export class GetPortalDomainDetail {
  constructor(
    private readonly portalDomainReadRepository: PortalDomainReadRepository,
  ) {}

  async execute(id: string): Promise<PortalDomainDetail> {
    const domain = await this.portalDomainReadRepository.findById(id)

    if (!domain) {
      throw new PortalDomainNotFoundError()
    }

    return domain
  }
}
