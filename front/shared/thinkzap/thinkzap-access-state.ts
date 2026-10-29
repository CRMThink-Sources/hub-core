import {
  THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapAccess,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'
import type { HttpOutcome } from '@/shared/aplication/aplication-context'

/**
 * Permissões do thinkzap vindas de `GET /api/thinkzap/access/me`.
 *
 * Estado discriminado porque a UI **não pode** tratar falha de leitura como
 * acesso liberado nem como acesso negado: durante `loading` ela não decide nada,
 * e em `error` mostra erro. Antes o layout lia `session.thinkzapAccess` e, com o
 * valor ainda `undefined`, calculava `accessBlocked` como `false` — o conteúdo
 * piscava antes de ser escondido.
 *
 * Ver spec `thinkzap-access-query`.
 */
export type ThinkzapAccessState =
  | { status: 'unauthenticated' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; access: ThinkzapAccess }

const GENERIC_ERROR = 'Não foi possível carregar suas permissões.'

const parsePermissions = (raw: unknown): ThinkzapUserPermissions | null => {
  if (!raw || typeof raw !== 'object') return null
  const source = { ...(raw as Record<string, Record<string, unknown>>) }
  // API anterior à categoria `thinkbot`: era protegido por `connectors`.
  if (!source.thinkbot && source.connectors) {
    source.thinkbot = {
      ...source.connectors,
      publish: source.connectors.update,
    }
  }
  const permissions = {} as Record<string, Record<string, boolean>>

  for (const category of THINKZAP_PERMISSION_CATEGORIES) {
    const actions = source[category]
    if (!actions || typeof actions !== 'object') return null
    permissions[category] = {}
    for (const action of THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY[category]) {
      permissions[category][action] = actions[action] === true
    }
  }

  return permissions as ThinkzapUserPermissions
}

const parseAccess = (data: unknown): ThinkzapAccess | null => {
  if (!data || typeof data !== 'object') return null
  const raw = data as Partial<ThinkzapAccess>
  const permissions = parsePermissions(raw.permissions)
  if (!permissions) return null

  return {
    canManageAccess: raw.canManageAccess === true,
    canAccess: raw.canAccess === true,
    canAccessFinance: raw.canAccessFinance === true,
    canAccessThinkbot:
      raw.canAccessThinkbot === undefined
        ? raw.canAccess === true
        : raw.canAccessThinkbot === true,
    permissions,
  }
}

export function toThinkzapAccessState(
  outcome: HttpOutcome,
): ThinkzapAccessState {
  if (outcome.kind === 'network') {
    return { status: 'error', message: outcome.message || GENERIC_ERROR }
  }

  if (outcome.kind === 'status') {
    if (outcome.status === 401) return { status: 'unauthenticated' }
    // `403` aqui é erro de contrato, não "negado": a rota é registrada antes do
    // middleware de acesso justamente para devolver `200` com payload negado.
    return { status: 'error', message: outcome.message || GENERIC_ERROR }
  }

  const access = parseAccess(outcome.data)
  if (!access) return { status: 'error', message: GENERIC_ERROR }

  return { status: 'ready', access }
}

export async function loadThinkzapAccess(deps: {
  readToken: () => string | null
  request: (token: string) => Promise<HttpOutcome>
}): Promise<ThinkzapAccessState> {
  const token = deps.readToken()
  if (!token) return { status: 'unauthenticated' }

  return toThinkzapAccessState(await deps.request(token))
}
