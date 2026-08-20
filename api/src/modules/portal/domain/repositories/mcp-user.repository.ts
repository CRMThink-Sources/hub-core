import type { McpUser, McpUserWithDomain } from '../entities/mcp-user'

export type CreateMcpUserInput = {
  email: string
  name: string
  passwordHash: string
  domainId: string
  isAdmin: boolean
  isActive: boolean
}

export type UpdateMcpUserInput = {
  name?: string
  domainId?: string
  isAdmin?: boolean
  isActive?: boolean
  passwordHash?: string
}

export type ListMcpUsersInput = {
  page: number
  limit: number
  search?: string
}

export type ListMcpUsersRepositoryResult = {
  users: McpUserWithDomain[]
  total: number
}

export interface McpUserRepository {
  findByEmail(email: string): Promise<McpUser | null>
  findById(id: string): Promise<McpUser | null>
  domainExists(domainId: string): Promise<boolean>
  create(input: CreateMcpUserInput): Promise<McpUser>
  update(id: string, input: UpdateMcpUserInput): Promise<McpUser>
  listWithPagination(
    input: ListMcpUsersInput,
  ): Promise<ListMcpUsersRepositoryResult>
}
