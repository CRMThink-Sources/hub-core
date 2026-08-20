import axios from 'axios'
import type { ResolvedApp } from '@/shared/app/app-codes'
import { envConfig } from '@/shared/infra/env-config'
import {
  fetchAppInfoFromCallMethod,
  fetchCurrentUserFromCallMethod,
  getBitrixAppInfoFromUrl,
} from './app-info'

/**
 * Contexto do Bitrix já resolvido durante a autenticação. Sai no resultado para
 * que o chamador possa registrar o OAuth do operador sem recomputar nada.
 */
export type BitrixAuthContext = {
  domain: string
  bitrixUserId: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export type BitrixBackendAuthSuccess = {
  ok: true
  token: string
  /** Identidade resolvida pelo backend — o front não decide nada aqui. */
  app: ResolvedApp
  bitrix: BitrixAuthContext
}

export type BitrixBackendAuthFailureReason =
  /** Página aberta fora do iframe do Bitrix (sem `DOMAIN` na URL). */
  | 'outside-bitrix'
  /** `BX24.getAuth()` não devolveu credencial. */
  | 'missing-bitrix-auth'
  /** `app.info` falhou ou não devolveu `CODE`. */
  | 'app-info-unavailable'
  /** Nem `user.current` nem a URL identificaram o usuário. */
  | 'unknown-bitrix-user'
  /** Backend não reconhece a app (`404` do catálogo). */
  | 'unknown-app'
  /** Qualquer outra falha do `POST /auth`. */
  | 'backend-error'

export type BitrixBackendAuthFailure = {
  ok: false
  reason: BitrixBackendAuthFailureReason
  error: string
}

export type BitrixBackendAuthResult =
  | BitrixBackendAuthSuccess
  | BitrixBackendAuthFailure

const fail = (
  reason: BitrixBackendAuthFailureReason,
  error: string,
): BitrixBackendAuthFailure => ({ ok: false, reason, error })

function extractBackendErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined

  const payload = data as {
    error?: { message?: string }
    result?: { error?: string }
  }

  return payload.error?.message ?? payload.result?.error
}

/** Shape mínimo esperado de `result.app`. Sem ele o login não sabe para onde ir. */
function parseResolvedApp(raw: unknown): ResolvedApp | null {
  if (!raw || typeof raw !== 'object') return null
  const app = raw as Partial<ResolvedApp>
  if (!app.appCode || !app.appCodeId || !app.slug) return null
  return {
    appCode: app.appCode,
    appCodeId: app.appCodeId,
    slug: app.slug,
    requiresOperatorOAuth: app.requiresOperatorOAuth === true,
  }
}

/**
 * Autentica no backend e devolve token + identidade da app.
 *
 * **Não grava token, não redireciona e não chama `bitrix-oauth`.** Quem chama
 * decide isso a partir de `app` — é o que mantém o fluxo sem condicional por
 * nome de aplicação. Ver spec `app-login-redirect`.
 */
export async function authenticateBitrixWithBackend(): Promise<BitrixBackendAuthResult> {
  const urlInfo = getBitrixAppInfoFromUrl()
  if (!urlInfo.domain) {
    return fail('outside-bitrix', 'Domínio Bitrix24 não encontrado na URL.')
  }

  const auth = window.BX24?.getAuth?.()
  if (!auth || typeof auth === 'boolean') {
    return fail(
      'missing-bitrix-auth',
      'Não foi possível obter o token de autenticação do Bitrix24.',
    )
  }

  let appCode = ''
  try {
    const appInfoData = await fetchAppInfoFromCallMethod()
    appCode = appInfoData?.CODE ?? ''
  } catch {
    return fail(
      'app-info-unavailable',
      'Não foi possível obter o código do app (app.info).',
    )
  }

  if (!appCode) {
    return fail(
      'app-info-unavailable',
      'Não foi possível obter o código do app (app.info).',
    )
  }

  let currentUser
  try {
    currentUser = await fetchCurrentUserFromCallMethod()
  } catch (err) {
    console.warn('Falha ao obter user.current via BX24:', err)
    currentUser = undefined
  }

  const bitrixUserId =
    (currentUser?.ID != null ? String(currentUser.ID) : undefined) ??
    urlInfo.urlParams?.USER_ID

  if (!bitrixUserId) {
    return fail(
      'unknown-bitrix-user',
      'Não foi possível identificar o usuário do Bitrix24.',
    )
  }

  const isBitrixAdmin = Boolean(window.BX24?.isAdmin?.())

  const displayName =
    [currentUser?.NAME, currentUser?.LAST_NAME].filter(Boolean).join(' ') ||
    undefined

  const rawDepts = currentUser?.UF_DEPARTMENT
  const bitrixDepartmentIds = Array.isArray(rawDepts)
    ? rawDepts.map(String).filter(Boolean)
    : []

  let response
  try {
    response = await axios.post(`${envConfig.apiUrl}/auth`, {
      domain: urlInfo.domain,
      member_id: urlInfo.member_id ?? auth.member_id ?? '',
      app_code: appCode,
      access_token: auth.access_token,
      bitrix_user_id: bitrixUserId,
      is_bitrix_admin: isBitrixAdmin,
      bitrix_user_name: displayName,
      bitrix_user_email: currentUser?.EMAIL ?? undefined,
      bitrix_department_ids: bitrixDepartmentIds,
    })
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message =
        extractBackendErrorMessage(err.response?.data) ??
        err.message ??
        'Falha ao autenticar no backend.'
      // `404` no login é sempre app fora do catálogo — o backend responde antes
      // de qualquer leitura de instalação.
      const reason =
        err.response?.status === 404 ? 'unknown-app' : 'backend-error'
      return fail(reason, message)
    }

    return fail(
      'backend-error',
      err instanceof Error ? err.message : 'Erro ao autenticar.',
    )
  }

  const result = response.data?.result as
    | { token?: string; app?: unknown }
    | undefined
  const token = result?.token
  const app = parseResolvedApp(result?.app)

  if (!token) {
    return fail(
      'backend-error',
      extractBackendErrorMessage(response.data) ??
        'Falha ao autenticar no backend.',
    )
  }

  if (!app) {
    return fail(
      'unknown-app',
      'O backend não devolveu a identidade da aplicação.',
    )
  }

  return {
    ok: true,
    token,
    app,
    bitrix: {
      domain: urlInfo.domain,
      bitrixUserId,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresIn: auth.expires_in,
    },
  }
}

/**
 * Registra o refresh token do operador. Chamada apenas para apps que declaram
 * `requiresOperatorOAuth`; a falha não bloqueia o login — a app funciona sem o
 * OAuth de operador, só perde o envio em nome do usuário.
 */
export async function registerOperatorOAuth(
  appCode: string,
  bitrix: BitrixAuthContext,
): Promise<void> {
  if (!bitrix.refreshToken) return

  await axios.post(`${envConfig.apiUrl}/auth/bitrix-oauth`, {
    domain: bitrix.domain,
    app_code: appCode,
    bitrix_user_id: bitrix.bitrixUserId,
    access_token: bitrix.accessToken,
    refresh_token: bitrix.refreshToken,
    expires_in: bitrix.expiresIn,
  })
}
