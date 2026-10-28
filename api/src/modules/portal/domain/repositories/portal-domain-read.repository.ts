import type { PortalDomainDetail } from '../entities/portal-domain'

export interface PortalDomainReadRepository {
  listAll(): Promise<PortalDomainDetail[]>
  findById(id: string): Promise<PortalDomainDetail | null>
  /** Só o número de clientes — `listAll` hidrata apps e seria caro para contar. */
  countAll(): Promise<number>
}
