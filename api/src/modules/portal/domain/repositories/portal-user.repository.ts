import type { PortalUser } from '../entities/portal-user'

export type CreatePortalUserInput = {
  email: string
  name: string
  passwordHash: string
  role: 'ADMIN'
  isActive: boolean
}

export interface PortalUserRepository {
  findByEmail(email: string): Promise<PortalUser | null>
  findById(id: string): Promise<PortalUser | null>
  create(input: CreatePortalUserInput): Promise<PortalUser>
}
