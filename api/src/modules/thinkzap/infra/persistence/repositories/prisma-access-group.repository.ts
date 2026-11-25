import { prisma } from '@/config/prisma'
import type {
  AccessGroup,
  AccessGroupDepartment,
  AccessGroupInput,
} from '@/modules/thinkzap/domain/entities/access-group'
import { AccessGroupNameTakenError } from '@/modules/thinkzap/domain/errors/access-group-name-taken.error'
import { AccessGroupNotFoundError } from '@/modules/thinkzap/domain/errors/access-group-not-found.error'
import type {
  AccessGroupMembership,
  AccessGroupRepository,
} from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'

type GroupRow = {
  id: string
  appId: string
  name: string
  createdAt: Date
  updatedAt: Date
  members: { bitrixUserId: string }[]
  lines: { subscriptionItemId: string }[]
  departments: { bitrixDepartmentId: string; includeSubdepartments: boolean }[]
}

const include = {
  members: { select: { bitrixUserId: true } },
  lines: { select: { subscriptionItemId: true } },
  departments: {
    select: { bitrixDepartmentId: true, includeSubdepartments: true },
  },
} as const

function mapRow(row: GroupRow): AccessGroup {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    memberIds: row.members.map(m => m.bitrixUserId),
    lineIds: row.lines.map(l => l.subscriptionItemId),
    departments: row.departments.map(d => ({
      departmentId: d.bitrixDepartmentId,
      includeSubdepartments: d.includeSubdepartments,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/** Um vínculo por departamento (índice único); repetido, vale o último. */
function departmentRows(departments: AccessGroupDepartment[]) {
  return [...new Map(departments.map(d => [d.departmentId, d])).values()].map(
    d => ({
      bitrixDepartmentId: d.departmentId,
      includeSubdepartments: d.includeSubdepartments,
    }),
  )
}

/** Um grupo alcança o usuário por qualquer um destes caminhos. */
function membershipFilters({
  bitrixUserId,
  departmentIds,
  ancestorDepartmentIds,
}: AccessGroupMembership) {
  return [
    { members: { some: { bitrixUserId } } },
    ...(departmentIds.length > 0
      ? [
          {
            departments: {
              some: { bitrixDepartmentId: { in: departmentIds } },
            },
          },
        ]
      : []),
    ...(ancestorDepartmentIds.length > 0
      ? [
          {
            departments: {
              some: {
                bitrixDepartmentId: { in: ancestorDepartmentIds },
                includeSubdepartments: true,
              },
            },
          },
        ]
      : []),
  ]
}

/** Violação do índice único (appId, name): a collation ignora maiúsculas. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export class PrismaAccessGroupRepository implements AccessGroupRepository {
  async list(appId: string): Promise<AccessGroup[]> {
    const rows = await prisma.thinkzapAccessGroup.findMany({
      where: { appId },
      orderBy: { createdAt: 'asc' },
      include,
    })
    return rows.map(mapRow)
  }

  async hasAny(appId: string): Promise<boolean> {
    const row = await prisma.thinkzapAccessGroup.findFirst({
      where: { appId },
      select: { id: true },
    })
    return row !== null
  }

  async hasInheritingDepartments(appId: string): Promise<boolean> {
    const row = await prisma.thinkzapAccessGroupDepartment.findFirst({
      where: { includeSubdepartments: true, group: { appId } },
      select: { id: true },
    })
    return row !== null
  }

  async listLineIdsForUser(
    appId: string,
    membership: AccessGroupMembership,
  ): Promise<string[]> {
    const rows = await prisma.thinkzapAccessGroupLine.findMany({
      where: { group: { appId, OR: membershipFilters(membership) } },
      select: { subscriptionItemId: true },
    })
    return unique(rows.map(r => r.subscriptionItemId))
  }

  async create(appId: string, input: AccessGroupInput): Promise<AccessGroup> {
    try {
      const row = await prisma.thinkzapAccessGroup.create({
        data: {
          appId,
          name: input.name,
          members: {
            create: unique(input.memberIds).map(bitrixUserId => ({
              bitrixUserId,
            })),
          },
          lines: {
            create: unique(input.lineIds).map(subscriptionItemId => ({
              subscriptionItemId,
            })),
          },
          departments: { create: departmentRows(input.departments ?? []) },
        },
        include,
      })
      return mapRow(row)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AccessGroupNameTakenError(input.name)
      }
      throw error
    }
  }

  async update(
    appId: string,
    groupId: string,
    input: AccessGroupInput,
  ): Promise<AccessGroup> {
    const existing = await prisma.thinkzapAccessGroup.findFirst({
      where: { id: groupId, appId },
      select: { id: true },
    })
    if (!existing) throw new AccessGroupNotFoundError(groupId)

    try {
      const row = await prisma.thinkzapAccessGroup.update({
        where: { id: groupId },
        data: {
          name: input.name,
          members: {
            deleteMany: {},
            create: unique(input.memberIds).map(bitrixUserId => ({
              bitrixUserId,
            })),
          },
          lines: {
            deleteMany: {},
            create: unique(input.lineIds).map(subscriptionItemId => ({
              subscriptionItemId,
            })),
          },
          departments: input.departments && {
            deleteMany: {},
            create: departmentRows(input.departments),
          },
        },
        include,
      })
      return mapRow(row)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AccessGroupNameTakenError(input.name)
      }
      throw error
    }
  }

  async remove(appId: string, groupId: string): Promise<boolean> {
    const { count } = await prisma.thinkzapAccessGroup.deleteMany({
      where: { id: groupId, appId },
    })
    return count > 0
  }
}
