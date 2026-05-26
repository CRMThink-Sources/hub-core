import { z } from 'zod'

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

const categoryPermissionsSchema = z.object({
  read: z.boolean(),
  create: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
})

export const thinkzapUserPermissionsSchema = z.object({
  connectors: categoryPermissionsSchema,
  finance: categoryPermissionsSchema,
})

export const FULL_THINKZAP_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: true, create: true, update: true, delete: true },
}

export const DEFAULT_ALLOWED_USER_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: true, create: true, update: true, delete: true },
  finance: { read: false, create: false, update: false, delete: false },
}

export function parseThinkzapUserPermissions(
  raw: unknown,
): ThinkzapUserPermissions {
  const parsed = thinkzapUserPermissionsSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_ALLOWED_USER_PERMISSIONS
}

export function hasThinkzapPermission(
  permissions: ThinkzapUserPermissions,
  category: ThinkzapPermissionCategory,
  action: ThinkzapPermissionAction,
): boolean {
  return permissions[category][action] === true
}

export function canAccessThinkzapCategory(
  permissions: ThinkzapUserPermissions,
  category: ThinkzapPermissionCategory,
): boolean {
  const p = permissions[category]
  return p.read || p.create || p.update || p.delete
}
