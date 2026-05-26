'use client'

import { useSession } from '@/providers/session-provider'
import { isBitrixAdmin } from '@/bitrix'
import {
  hasThinkzapPermission,
  type ThinkzapAccess,
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

export function useThinkzapAccess(): ThinkzapAccess | null {
  const { session } = useSession()
  return (session?.thinkzapAccess as ThinkzapAccess | undefined) ?? null
}

export function useCanThinkzap(
  category: ThinkzapPermissionCategory,
  action: ThinkzapPermissionAction,
): boolean {
  const access = useThinkzapAccess()
  if (!access) return false
  if (access.canManageAccess || isBitrixAdmin()) return true
  return hasThinkzapPermission(access.permissions, category, action)
}

export function useThinkzapPermissions(): ThinkzapUserPermissions | null {
  const access = useThinkzapAccess()
  if (!access) return null
  if (access.canManageAccess || isBitrixAdmin()) {
    return access.permissions
  }
  return access.permissions
}
