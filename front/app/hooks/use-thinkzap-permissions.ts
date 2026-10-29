'use client'

import { useThinkzapAccessState } from '@/providers/thinkzap-access-provider'
import { isBitrixAdmin } from '@/bitrix'
import {
  hasThinkzapPermission,
  type ThinkzapAccess,
  type ThinkzapPermissionActionOf,
  type ThinkzapPermissionCategory,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

/**
 * Acesso do usuário no thinkzap, de `GET /api/thinkzap/access/me`.
 *
 * `null` cobre três casos distintos — carregando, erro e não autenticado. Quem
 * precisa diferenciar (o layout, que não pode decidir bloqueio com permissão
 * ausente) usa `useThinkzapAccessState()` direto.
 */
export function useThinkzapAccess(): ThinkzapAccess | null {
  const { state } = useThinkzapAccessState()
  return state.status === 'ready' ? state.access : null
}

export function useCanThinkzap<C extends ThinkzapPermissionCategory>(
  category: C,
  action: ThinkzapPermissionActionOf<C>,
): boolean {
  const access = useThinkzapAccess()
  if (!access) return false
  if (access.canManageAccess || isBitrixAdmin()) return true
  return hasThinkzapPermission(access.permissions, category, action)
}

export function useThinkzapPermissions(): ThinkzapUserPermissions | null {
  return useThinkzapAccess()?.permissions ?? null
}
