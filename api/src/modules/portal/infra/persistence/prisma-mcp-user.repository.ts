import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import type { McpUser, McpUserWithDomain } from '../../domain/entities/mcp-user'
import type {
  CreateMcpUserInput,
  ListMcpUsersInput,
  ListMcpUsersRepositoryResult,
  McpUserRepository,
  UpdateMcpUserInput,
} from '../../domain/repositories/mcp-user.repository'

type McpUserRow = {
  id: string
  email: string
  name: string
  passwordHash: string
  domainId: string
  isAdmin: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function toMcpUser(row: McpUserRow): McpUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    domainId: row.domainId,
    isAdmin: row.isAdmin,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PrismaMcpUserRepository implements McpUserRepository {
  async findByEmail(email: string): Promise<McpUser | null> {
    const user = await prisma.mcpUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    })
    return user ? toMcpUser(user) : null
  }

  async findById(id: string): Promise<McpUser | null> {
    const user = await prisma.mcpUser.findUnique({ where: { id } })
    return user ? toMcpUser(user) : null
  }

  async domainExists(domainId: string): Promise<boolean> {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true },
    })
    return domain !== null
  }

  async create(input: CreateMcpUserInput): Promise<McpUser> {
    const user = await prisma.mcpUser.create({
      data: {
        id: randomUUID(),
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        domainId: input.domainId,
        isAdmin: input.isAdmin,
        isActive: input.isActive,
      },
    })
    return toMcpUser(user)
  }

  async update(id: string, input: UpdateMcpUserInput): Promise<McpUser> {
    const user = await prisma.mcpUser.update({
      where: { id },
      data: {
        name: input.name,
        domainId: input.domainId,
        isAdmin: input.isAdmin,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
      },
    })
    return toMcpUser(user)
  }

  async listWithPagination(
    input: ListMcpUsersInput,
  ): Promise<ListMcpUsersRepositoryResult> {
    const { page, limit, search } = input
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [{ name: { contains: search } }, { email: { contains: search } }],
        }
      : {}

    const [total, rows] = await Promise.all([
      prisma.mcpUser.count({ where }),
      prisma.mcpUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { domain: { select: { name: true } } },
      }),
    ])

    const users: McpUserWithDomain[] = rows.map(row => ({
      ...toMcpUser(row),
      domainName: row.domain.name,
    }))

    return { users, total }
  }
}
