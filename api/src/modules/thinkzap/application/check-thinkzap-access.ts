import { GetAllowedUserRepository } from '../domain/repositories/allowed-user/get-allowed-user.repository'
import { GetAllowedDepartmentsForUserRepository } from '../domain/repositories/allowed-department/get-allowed-departments-for-user.repository'
import { AllowedDepartment } from '../domain/entities/allowed-department'
import {
  canAccessThinkzapCategory,
  FULL_THINKZAP_PERMISSIONS,
  THINKZAP_PERMISSION_ACTIONS,
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
}

export const DENIED_THINKZAP_ACCESS: ThinkzapAccessResult = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: false,
  permissions: {
    connectors: { read: false, create: false, update: false, delete: false },
    finance: { read: false, create: false, update: false, delete: false },
  },
}

function mergeDepartmentPermissions(
  depts: AllowedDepartment[],
): ThinkzapUserPermissions {
  const result = {} as ThinkzapUserPermissions
  for (const category of THINKZAP_PERMISSION_CATEGORIES) {
    result[category] = {} as (typeof result)[typeof category]
    for (const action of THINKZAP_PERMISSION_ACTIONS) {
      result[category][action] = depts.some(d => d.permissions[category][action])
    }
  }
  return result
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
    }
  }

  const user = await getAllowedUser.getByAppIdAndBitrixUserId(
    ctx.installedAppId,
    ctx.bitrixUserId,
  )

  if (user) {
    return {
      canManageAccess: false,
      permissions: user.permissions,
      canAccess: canAccessThinkzapCategory(user.permissions, 'connectors'),
      canAccessFinance: canAccessThinkzapCategory(user.permissions, 'finance'),
    }
  }

  if (
    getAllowedDepartments &&
    ctx.bitrixDepartmentIds &&
    ctx.bitrixDepartmentIds.length > 0
  ) {
    const matchedDepts = await getAllowedDepartments.getDepartmentsByAppIdAndIds(
      ctx.installedAppId,
      ctx.bitrixDepartmentIds,
    )

    if (matchedDepts.length > 0) {
      const permissions = mergeDepartmentPermissions(matchedDepts)
      return {
        canManageAccess: false,
        permissions,
        canAccess: canAccessThinkzapCategory(permissions, 'connectors'),
        canAccessFinance: canAccessThinkzapCategory(permissions, 'finance'),
      }
    }
  }

  return null
}
