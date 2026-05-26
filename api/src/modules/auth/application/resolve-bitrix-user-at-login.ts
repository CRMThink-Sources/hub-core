import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export type ResolvedBitrixUser = {
  bitrixUserId: string
  displayName: string | null
  email: string | null
  isBitrixAdmin: boolean
  bitrixDepartmentIds: string[]
}

type BitrixCurrentUser = {
  ID?: string | number
  NAME?: string
  LAST_NAME?: string
  EMAIL?: string
  UF_DEPARTMENT?: unknown
}

function normalizeBitrixDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/**
 * Resolve o usuário do Bitrix24 no login.
 *
 * Estratégia:
 *   1. Confia primeiro nos dados enviados pelo front (obtidos via BX24.callMethod
 *      no iframe — fonte confiável já validada pelo Bitrix).
 *   2. Tenta enriquecer/verificar via REST (`user.current`) usando o access_token,
 *      mas não falha se a chamada REST der erro (escopo, rede, etc.).
 *
 * Se mesmo assim não conseguir um `bitrixUserId`, lança erro.
 */
export async function resolveBitrixUserAtLogin(params: {
  domain: string
  accessToken: string
  bitrixUserIdFallback?: string
  bitrixUserNameFallback?: string
  bitrixUserEmailFallback?: string
  isBitrixAdminFallback?: boolean
  bitrixDepartmentIdsFallback?: string[]
}): Promise<ResolvedBitrixUser> {
  const client = new BitrixRestClient(
    normalizeBitrixDomain(params.domain),
    params.accessToken,
  )

  let current: BitrixCurrentUser = {}
  try {
    const rawCurrent = await client.callMethod('user.current', {})
    current = (
      rawCurrent && typeof rawCurrent === 'object' ? rawCurrent : {}
    ) as BitrixCurrentUser
  } catch (err) {
    console.warn(
      '[resolveBitrixUserAtLogin] user.current REST falhou, usando fallback do iframe BX24:',
      err instanceof Error ? err.message : err,
    )
  }

  const restUserId = current.ID != null ? String(current.ID) : undefined

  const bitrixUserId = restUserId ?? params.bitrixUserIdFallback ?? ''

  if (!bitrixUserId) {
    throw new Error(
      'Não foi possível obter o usuário do Bitrix24 (user.current REST e BX24 callMethod retornaram vazios)',
    )
  }

  const restName =
    [current.NAME, current.LAST_NAME].filter(Boolean).join(' ') || undefined
  const displayName = restName ?? params.bitrixUserNameFallback ?? null

  const email = current.EMAIL ?? params.bitrixUserEmailFallback ?? null

  const rawDepts = current.UF_DEPARTMENT
  let bitrixDepartmentIds: string[] = params.bitrixDepartmentIdsFallback ?? []
  if (Array.isArray(rawDepts) && rawDepts.length > 0) {
    bitrixDepartmentIds = rawDepts.map(String).filter(Boolean)
  }

  return {
    bitrixUserId,
    displayName,
    email,
    isBitrixAdmin: params.isBitrixAdminFallback ?? false,
    bitrixDepartmentIds,
  }
}
