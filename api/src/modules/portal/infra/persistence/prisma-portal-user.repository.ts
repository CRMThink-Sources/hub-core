import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import type { PortalUser } from '../../domain/entities/portal-user'
import type {
  CreatePortalUserInput,
  PortalUserRepository,
} from '../../domain/repositories/portal-user.repository'

function toPortalUser(row: {
  id: string
  email: string
  name: string
  passwordHash: string
  role: 'ADMIN'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): PortalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PrismaPortalUserRepository implements PortalUserRepository {
  async findByEmail(email: string): Promise<PortalUser | null> {
    const user = await prisma.portalUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user) {
      return null
    }

    return toPortalUser(user)
  }

  async findById(id: string): Promise<PortalUser | null> {
    const user = await prisma.portalUser.findUnique({
      where: { id },
    })

    if (!user) {
      return null
    }

    return toPortalUser(user)
  }

  async create(input: CreatePortalUserInput): Promise<PortalUser> {
    const user = await prisma.portalUser.create({
      data: {
        id: randomUUID(),
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        isActive: input.isActive,
      },
    })

    return toPortalUser(user)
  }
}
