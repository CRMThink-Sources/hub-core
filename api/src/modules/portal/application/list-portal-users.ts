import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'

export type ListPortalUsersInput = {
  page: number
  limit: number
  search?: string
}

export type PortalUserSummary = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  bitrixUserId: number | null
  createdAt: string
}

export type ListPortalUsersOutput = {
  users: PortalUserSummary[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export class ListPortalUsers {
  constructor(private readonly portalUserRepository: PortalUserRepository) {}

  async execute(input: ListPortalUsersInput): Promise<ListPortalUsersOutput> {
    const { users, total } =
      await this.portalUserRepository.listWithPagination(input)

    return {
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        bitrixUserId: u.bitrixUserId,
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
