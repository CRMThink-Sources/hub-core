import type { PortalUser } from '../entities/portal-user'

export type CreatePortalUserInput = {
  email: string
  name: string
  passwordHash: string
  role: 'ADMIN'
  isActive: boolean
}

export type ListPortalUsersInput = {
  page: number
  limit: number
  search?: string
}

export type ListPortalUsersRepositoryResult = {
  users: PortalUser[]
  total: number
}

export interface PortalUserRepository {
  findByEmail(email: string): Promise<PortalUser | null>
  findById(id: string): Promise<PortalUser | null>
  create(input: CreatePortalUserInput): Promise<PortalUser>
  listWithPagination(
    input: ListPortalUsersInput,
  ): Promise<ListPortalUsersRepositoryResult>
}
