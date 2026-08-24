import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import { AllowedUser } from '@/modules/thinkzap/domain/entities/allowed-user'
import { AddAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/add-allowed-user.repository'
import { ExistsAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/exists-allowed-user.repository'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { ListAllowedUsersRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/list-allowed-users.repository'
import { RemoveAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/remove-allowed-user.repository'
import { UpdateAllowedUserDisplayNameRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/update-allowed-user-display-name.repository'
import { UpdateAllowedUserPermissionsRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/update-allowed-user-permissions.repository'
import {
  DEFAULT_ALLOWED_USER_PERMISSIONS,
  parseThinkzapUserPermissions,
} from '@/modules/thinkzap/domain/thinkzap-permissions'

function mapRow(row: {
  id: string
  appId: string
  bitrixUserId: string
  displayName: string | null
  email: string | null
  permissions: unknown
  createdAt: Date
}): AllowedUser {
  return {
    id: row.id,
    appId: row.appId,
    bitrixUserId: row.bitrixUserId,
    displayName: row.displayName,
    email: row.email,
    permissions: parseThinkzapUserPermissions(row.permissions),
    createdAt: row.createdAt,
  }
}

export class PrismaAllowedUserRepository
  implements
    ListAllowedUsersRepository,
    AddAllowedUserRepository,
    RemoveAllowedUserRepository,
    ExistsAllowedUserRepository,
    GetAllowedUserRepository,
    UpdateAllowedUserPermissionsRepository,
    UpdateAllowedUserDisplayNameRepository
{
  async listByAppId(appId: string): Promise<AllowedUser[]> {
    const rows = await prisma.thinkzapAllowedUser.findMany({
      where: { appId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(mapRow)
  }

  async getByAppIdAndBitrixUserId(
    appId: string,
    bitrixUserId: string,
  ): Promise<AllowedUser | null> {
    const row = await prisma.thinkzapAllowedUser.findFirst({
      where: { appId, bitrixUserId },
    })
    return row ? mapRow(row) : null
  }

  async add(input: {
    appId: string
    bitrixUserId: string
    displayName?: string | null
    email?: string | null
    permissions?: typeof DEFAULT_ALLOWED_USER_PERMISSIONS
  }): Promise<AllowedUser> {
    const row = await prisma.thinkzapAllowedUser.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        bitrixUserId: input.bitrixUserId,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        permissions: input.permissions ?? DEFAULT_ALLOWED_USER_PERMISSIONS,
      },
    })
    return mapRow(row)
  }

  async updatePermissions(
    appId: string,
    bitrixUserId: string,
    permissions: typeof DEFAULT_ALLOWED_USER_PERMISSIONS,
  ): Promise<void> {
    await prisma.thinkzapAllowedUser.updateMany({
      where: { appId, bitrixUserId },
      data: { permissions },
    })
  }

  /**
   * `updateMany` e não `upsert`: sem row, nada acontece. A row é o que concede
   * acesso ao app — criar uma aqui daria permissão a quem só entrou para ter o
   * nome atualizado.
   */
  async updateDisplayName(
    appId: string,
    bitrixUserId: string,
    displayName: string,
  ): Promise<number> {
    const { count } = await prisma.thinkzapAllowedUser.updateMany({
      where: { appId, bitrixUserId },
      data: { displayName },
    })
    return count
  }

  async remove(appId: string, bitrixUserId: string): Promise<void> {
    await prisma.thinkzapAllowedUser.deleteMany({
      where: { appId, bitrixUserId },
    })
  }

  async exists(appId: string, bitrixUserId: string): Promise<boolean> {
    const count = await prisma.thinkzapAllowedUser.count({
      where: { appId, bitrixUserId },
    })
    return count > 0
  }
}
