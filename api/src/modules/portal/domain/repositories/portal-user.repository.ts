import type { PortalUser } from '../entities/portal-user'

export type CreatePortalUserInput = {
  email: string
  name: string
  passwordHash: string
  role: 'ADMIN'
  isActive: boolean
  bitrixUserId?: number | null
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
  /** Só a coluna do vínculo; `null` remove. Devolve `null` se o usuário não existe. */
  updateBitrixUserId(
    id: string,
    bitrixUserId: number | null,
  ): Promise<PortalUser | null>
  listWithPagination(
    input: ListPortalUsersInput,
  ): Promise<ListPortalUsersRepositoryResult>
}
