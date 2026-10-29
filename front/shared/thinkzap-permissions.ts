export const THINKZAP_PERMISSION_CATEGORIES = [
  'connectors',
  'finance',
  'thinkbot',
] as const
export type ThinkzapPermissionCategory =
  (typeof THINKZAP_PERMISSION_CATEGORIES)[number]

const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export const THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY = {
  connectors: CRUD_ACTIONS,
  finance: CRUD_ACTIONS,
  thinkbot: [...CRUD_ACTIONS, 'publish'] as const,
} as const satisfies Record<ThinkzapPermissionCategory, readonly string[]>

export type ThinkzapPermissionActionOf<C extends ThinkzapPermissionCategory> =
  (typeof THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY)[C][number]

export type ThinkzapPermissionAction =
  ThinkzapPermissionActionOf<ThinkzapPermissionCategory>

export type ThinkzapUserPermissions = {
  [C in ThinkzapPermissionCategory]: Record<
    ThinkzapPermissionActionOf<C>,
    boolean
  >
}

export type ThinkzapAccess = {
  canManageAccess: boolean
  canAccess: boolean
  canAccessFinance: boolean
  canAccessThinkbot: boolean
  permissions: ThinkzapUserPermissions
}

export const DEFAULT_ALLOWED_USER_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: false, create: false, update: false, delete: false },
  thinkbot: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
  },
}

export const FULL_THINKZAP_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: true, create: true, update: true, delete: true },
  thinkbot: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
  },
}

export function hasThinkzapPermission<C extends ThinkzapPermissionCategory>(
  permissions: ThinkzapUserPermissions | undefined,
  category: C,
  action: ThinkzapPermissionActionOf<C>,
): boolean {
  if (!permissions) return false
  const actions = permissions[category] as Record<string, boolean>
  return actions[action] === true
}

export function canAccessThinkzapCategory(
  permissions: ThinkzapUserPermissions | undefined,
  category: ThinkzapPermissionCategory,
): boolean {
  if (!permissions) return false
  return Object.values(permissions[category]).some(Boolean)
}
