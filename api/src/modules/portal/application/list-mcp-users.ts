import type { McpUserRepository } from '../domain/repositories/mcp-user.repository'

export type ListMcpUsersInput = {
  page: number
  limit: number
  search?: string
}

export type McpUserSummary = {
  id: string
  name: string
  email: string
  domainId: string
  domainName: string
  isAdmin: boolean
  isActive: boolean
  createdAt: string
}

export type ListMcpUsersOutput = {
  users: McpUserSummary[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export class ListMcpUsers {
  constructor(private readonly mcpUserRepository: McpUserRepository) {}

  async execute(input: ListMcpUsersInput): Promise<ListMcpUsersOutput> {
    const { users, total } =
      await this.mcpUserRepository.listWithPagination(input)

    return {
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        domainId: u.domainId,
        domainName: u.domainName,
        isAdmin: u.isAdmin,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
      meta: {
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      },
    }
  }
}
