import { GetAllowedUserRepository } from '../domain/repositories/allowed-user/get-allowed-user.repository'
import { GetAllowedDepartmentsForUserRepository } from '../domain/repositories/allowed-department/get-allowed-departments-for-user.repository'
import { AllowedDepartment } from '../domain/entities/allowed-department'
import {
  canAccessThinkzapCategory,
  FULL_THINKZAP_PERMISSIONS,
  NO_THINKZAP_PERMISSIONS,
  THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapUserPermissions,
} from '../domain/thinkzap-permissions'

export type ThinkzapAccessContext = {
  installedAppId: string
  bitrixUserId: string
  isBitrixAdmin: boolean
  bitrixDepartmentIds?: string[]
}

export type ThinkzapAccessResult = {
  /** Admin Bitrix — gerencia tela de permissões */
  canManageAccess: boolean
  permissions: ThinkzapUserPermissions
  /** Acesso à categoria conectores (qualquer ação ou leitura) */
  canAccess: boolean
  /** Acesso à categoria financeiro */
  canAccessFinance: boolean
  /** Acesso à categoria ThinkBot */
  canAccessThinkbot: boolean
}

export const DENIED_THINKZAP_ACCESS: ThinkzapAccessResult = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: false,
  canAccessThinkbot: false,
  permissions: NO_THINKZAP_PERMISSIONS,
}

function mergeDepartmentPermissions(
  depts: AllowedDepartment[],
): ThinkzapUserPermissions {
  const result = {} as Record<string, Record<string, boolean>>
  for (const category of THINKZAP_PERMISSION_CATEGORIES) {
    result[category] = {}
    for (const action of THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY[category]) {
      result[category][action] = depts.some(
        d => (d.permissions[category] as Record<string, boolean>)[action],
      )
    }
  }
  return result as ThinkzapUserPermissions
}

function grantedAccess(
  permissions: ThinkzapUserPermissions,
): ThinkzapAccessResult {
  return {
    canManageAccess: false,
    permissions,
    canAccess: canAccessThinkzapCategory(permissions, 'connectors'),
    canAccessFinance: canAccessThinkzapCategory(permissions, 'finance'),
    canAccessThinkbot: canAccessThinkzapCategory(permissions, 'thinkbot'),
  }
}

export async function checkThinkzapAccess(
  getAllowedUser: GetAllowedUserRepository,
  ctx: ThinkzapAccessContext,
  getAllowedDepartments?: GetAllowedDepartmentsForUserRepository,
): Promise<ThinkzapAccessResult | null> {
  if (ctx.isBitrixAdmin) {
    return {
      canManageAccess: true,
      permissions: FULL_THINKZAP_PERMISSIONS,
      canAccess: true,
      canAccessFinance: true,
      canAccessThinkbot: true,
    }
  }

  const user = await getAllowedUser.getByAppIdAndBitrixUserId(
    ctx.installedAppId,
    ctx.bitrixUserId,
  )

  if (user) return grantedAccess(user.permissions)

  if (
    getAllowedDepartments &&
    ctx.bitrixDepartmentIds &&
    ctx.bitrixDepartmentIds.length > 0
  ) {
    const matchedDepts =
      await getAllowedDepartments.getDepartmentsByAppIdAndIds(
        ctx.installedAppId,
        ctx.bitrixDepartmentIds,
      )

    if (matchedDepts.length > 0) {
      return grantedAccess(mergeDepartmentPermissions(matchedDepts))
    }
  }

  return null
}
