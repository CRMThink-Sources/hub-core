import type { PortalUser } from '../entities/portal-user'

export interface PortalUserRepository {
  findByEmail(email: string): Promise<PortalUser | null>
  findById(id: string): Promise<PortalUser | null>
}
