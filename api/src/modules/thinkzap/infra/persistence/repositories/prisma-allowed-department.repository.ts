import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import { AllowedDepartment } from '@/modules/thinkzap/domain/entities/allowed-department'
import { AddAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/add-allowed-department.repository'
import { ExistsAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/exists-allowed-department.repository'
import { GetAllowedDepartmentsForUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/get-allowed-departments-for-user.repository'
import { ListAllowedDepartmentsRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/list-allowed-departments.repository'
import { RemoveAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/remove-allowed-department.repository'
import { UpdateAllowedDepartmentPermissionsRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/update-allowed-department-permissions.repository'
import {
  DEFAULT_ALLOWED_USER_PERMISSIONS,
  parseThinkzapUserPermissions,
} from '@/modules/thinkzap/domain/thinkzap-permissions'

function mapRow(row: {
  id: string
  appId: string
  bitrixDepartmentId: string
  displayName: string | null
  permissions: unknown
  createdAt: Date
}): AllowedDepartment {
  return {
    id: row.id,
    appId: row.appId,
    bitrixDepartmentId: row.bitrixDepartmentId,
    displayName: row.displayName,
    permissions: parseThinkzapUserPermissions(row.permissions),
    createdAt: row.createdAt,
  }
}

export class PrismaAllowedDepartmentRepository
  implements
    ListAllowedDepartmentsRepository,
    AddAllowedDepartmentRepository,
    RemoveAllowedDepartmentRepository,
    ExistsAllowedDepartmentRepository,
    GetAllowedDepartmentsForUserRepository,
    UpdateAllowedDepartmentPermissionsRepository
{
  async listDepartmentsByAppId(appId: string): Promise<AllowedDepartment[]> {
    const rows = await prisma.thinkzapAllowedDepartment.findMany({
      where: { appId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(mapRow)
  }

  async getDepartmentsByAppIdAndIds(
    appId: string,
    bitrixDepartmentIds: string[],
  ): Promise<AllowedDepartment[]> {
    if (bitrixDepartmentIds.length === 0) return []
    const rows = await prisma.thinkzapAllowedDepartment.findMany({
      where: { appId, bitrixDepartmentId: { in: bitrixDepartmentIds } },
    })
    return rows.map(mapRow)
  }

  async addDepartment(input: {
    appId: string
    bitrixDepartmentId: string
    displayName?: string | null
    permissions?: typeof DEFAULT_ALLOWED_USER_PERMISSIONS
  }): Promise<AllowedDepartment> {
    const row = await prisma.thinkzapAllowedDepartment.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        bitrixDepartmentId: input.bitrixDepartmentId,
        displayName: input.displayName ?? null,
        permissions: input.permissions ?? DEFAULT_ALLOWED_USER_PERMISSIONS,
      },
    })
    return mapRow(row)
  }

  async updateDepartmentPermissions(
    appId: string,
    bitrixDepartmentId: string,
    permissions: typeof DEFAULT_ALLOWED_USER_PERMISSIONS,
  ): Promise<void> {
    await prisma.thinkzapAllowedDepartment.updateMany({
      where: { appId, bitrixDepartmentId },
      data: { permissions },
    })
  }

  async removeDepartment(
    appId: string,
    bitrixDepartmentId: string,
  ): Promise<void> {
    await prisma.thinkzapAllowedDepartment.deleteMany({
      where: { appId, bitrixDepartmentId },
    })
  }

  async existsDepartment(
    appId: string,
    bitrixDepartmentId: string,
  ): Promise<boolean> {
    const count = await prisma.thinkzapAllowedDepartment.count({
      where: { appId, bitrixDepartmentId },
    })
    return count > 0
  }
}
