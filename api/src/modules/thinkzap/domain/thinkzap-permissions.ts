import { z } from 'zod'

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

const crudSchema = z.object({
  read: z.boolean(),
  create: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
})

const thinkbotSchema = crudSchema.extend({ publish: z.boolean() })

// Rows anteriores ao `thinkbot` falhariam o parse e cairiam no padrão, perdendo o
// `finance`. Herdam de `connectors`, que protegia o ThinkBot (publicar exigia `update`).
export const thinkzapUserPermissionsSchema = z
  .object({
    connectors: crudSchema,
    finance: crudSchema,
    thinkbot: thinkbotSchema.optional(),
  })
  .transform(
    (p): ThinkzapUserPermissions => ({
      ...p,
      thinkbot: p.thinkbot ?? {
        ...p.connectors,
        publish: p.connectors.update,
      },
    }),
  )

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

export const NO_THINKZAP_PERMISSIONS: ThinkzapUserPermissions = {
  connectors: { read: false, create: false, update: false, delete: false },
  finance: { read: false, create: false, update: false, delete: false },
  thinkbot: {
    read: false,
    create: false,
    update: false,
    delete: false,
    publish: false,
  },
}

export function parseThinkzapUserPermissions(
  raw: unknown,
): ThinkzapUserPermissions {
  const parsed = thinkzapUserPermissionsSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_ALLOWED_USER_PERMISSIONS
}

export function hasThinkzapPermission<C extends ThinkzapPermissionCategory>(
  permissions: ThinkzapUserPermissions,
  category: C,
  action: ThinkzapPermissionActionOf<C>,
): boolean {
  const actions = permissions[category] as Record<string, boolean>
  return actions[action] === true
}

export function canAccessThinkzapCategory(
  permissions: ThinkzapUserPermissions,
  category: ThinkzapPermissionCategory,
): boolean {
  return Object.values(permissions[category]).some(Boolean)
}
