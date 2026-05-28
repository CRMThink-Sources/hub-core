import type { PortalDomainDetail } from '../entities/portal-domain'

export interface PortalDomainReadRepository {
  listAll(): Promise<PortalDomainDetail[]>
  findById(id: string): Promise<PortalDomainDetail | null>
}
