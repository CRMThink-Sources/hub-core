import axios from 'axios'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { envConfig } from '@/shared/infra/env-config'
import {
  fetchAppInfoFromCallMethod,
  fetchCurrentUserFromCallMethod,
  getBitrixAppInfoFromUrl,
} from './app-info'

export type BitrixBackendAuthSuccess = {
  ok: true
  token: string
  appCode: string
  storageAuthTokenKey: string
}

export type BitrixBackendAuthFailure = {
  ok: false
  error: string
}

export type BitrixBackendAuthResult =
  | BitrixBackendAuthSuccess
  | BitrixBackendAuthFailure

function extractBackendErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined

  const payload = data as {
    error?: { message?: string }
    result?: { error?: string }
  }

  return payload.error?.message ?? payload.result?.error
}

export async function authenticateBitrixWithBackend(): Promise<BitrixBackendAuthResult> {
  const urlInfo = getBitrixAppInfoFromUrl()
  if (!urlInfo.domain) {
    return { ok: false, error: 'Domínio Bitrix24 não encontrado na URL.' }
  }

  const auth = window.BX24?.getAuth?.()
  if (!auth || typeof auth === 'boolean') {
    return {
      ok: false,
      error: 'Não foi possível obter o token de autenticação do Bitrix24.',
    }
  }

  let appCode = ''
  try {
    const appInfoData = await fetchAppInfoFromCallMethod()
    appCode = appInfoData?.CODE ?? ''
  } catch {
    return {
      ok: false,
      error: 'Não foi possível obter o código do app (app.info).',
    }
  }

  if (!appCode) {
    return {
      ok: false,
      error: 'Não foi possível obter o código do app (app.info).',
    }
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
    return {
      ok: false,
      error: 'Não foi possível identificar o usuário do Bitrix24.',
    }
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
      return { ok: false, error: message }
    }

    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao autenticar.',
    }
  }

  const thinkzapCodes = [
    envConfig.appCodes.thinkzap,
    'crmthink.thinkzap',
  ].filter(Boolean)

  if (thinkzapCodes.includes(appCode) && auth.refresh_token) {
    try {
      await axios.post(`${envConfig.apiUrl}/auth/bitrix-oauth`, {
        domain: urlInfo.domain,
        app_code: appCode,
        bitrix_user_id: bitrixUserId,
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_in: auth.expires_in,
      })
    } catch (oauthErr) {
      console.warn('Falha ao salvar OAuth do operador:', oauthErr)
    }
  }

  const dataRedirect = getAppRedirectUrl(appCode)
  if (!dataRedirect) {
    return {
      ok: false,
      error: `Aplicação não configurada para o app: ${appCode}`,
    }
  }

  const authToken = response.data?.result?.token
  const errorMessage = extractBackendErrorMessage(response.data)

  if (!authToken) {
    return {
      ok: false,
      error: errorMessage ?? 'Falha ao autenticar no backend.',
    }
  }

  return {
    ok: true,
    token: authToken,
    appCode,
    storageAuthTokenKey: dataRedirect.storageAuthTokenKey,
  }
}
