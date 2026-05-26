export const THINKZAP_PERMISSION_CATEGORIES = ['connectors', 'finance'] as const
export type ThinkzapPermissionCategory =
  (typeof THINKZAP_PERMISSION_CATEGORIES)[number]

export const THINKZAP_PERMISSION_ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
] as const
export type ThinkzapPermissionAction =
  (typeof THINKZAP_PERMISSION_ACTIONS)[number]

export type ThinkzapCategoryPermissions = Record<
  ThinkzapPermissionAction,
  boolean
>

export type ThinkzapUserPermissions = Record<
  ThinkzapPermissionCategory,
  ThinkzapCategoryPermissions
>

export type ThinkzapAccess = {
  canManageAccess: boolean
  canAccess: boolean
  canAccessFinance: boolean
  permissions: ThinkzapUserPermissions
}

export const DEFAULT_ALLOWED_USER_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: false, create: false, update: false, delete: false },
}

export const FULL_THINKZAP_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: true, create: true, update: true, delete: true },
}

export function hasThinkzapPermission(
  permissions: ThinkzapUserPermissions | undefined,
  category: ThinkzapPermissionCategory,
  action: ThinkzapPermissionAction,
): boolean {
  if (!permissions) return false
  return permissions[category][action] === true
}

export function canAccessThinkzapCategory(
  permissions: ThinkzapUserPermissions | undefined,
  category: ThinkzapPermissionCategory,
): boolean {
  if (!permissions) return false
  const p = permissions[category]
  return p.read || p.create || p.update || p.delete
}
