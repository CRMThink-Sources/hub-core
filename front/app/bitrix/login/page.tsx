'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BX24Script,
  useBX24,
  fetchAppInfoFromCallMethod,
  fetchCurrentUserFromCallMethod,
  getBitrixAppInfoFromUrl,
} from '@/bitrix'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import axios from 'axios'
import { envConfig } from '@/shared/infra/env-config'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)
  const [authRedirecting, setAuthRedirecting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()

  // 2) Se estamos no Bitrix (DOMAIN na URL), autenticar e redirecionar conforme appCode
  useEffect(() => {
    if (!scriptLoaded || !bx24Ready || typeof window === 'undefined') return

    const urlInfo = getBitrixAppInfoFromUrl()
    if (!urlInfo.domain) return

    let cancelled = false

    async function runAuthAndRedirect() {
      setAuthRedirecting(true)
      setAuthError(null)
      try {
        const appInfoData = await fetchAppInfoFromCallMethod()
        const appCode = appInfoData?.CODE ?? ''
        if (!appCode) {
          setAuthError('Não foi possível obter o código do app (app.info).')
          setAuthRedirecting(false)
          return
        }
        console.log('url api:', { apiUrl: envConfig.apiUrl, env: process.env })

        const auth = window.BX24?.getAuth?.()
        if (!auth || typeof auth === 'boolean') {
          setAuthError('Não foi possível obter o token de autenticação do Bitrix24.')
          setAuthRedirecting(false)
          return
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
          setAuthError('Não foi possível identificar o usuário do Bitrix24.')
          setAuthRedirecting(false)
          return
        }

        const isBitrixAdmin = Boolean(window.BX24?.isAdmin?.())

        const displayName =
          [currentUser?.NAME, currentUser?.LAST_NAME].filter(Boolean).join(' ') ||
          undefined

        const rawDepts = currentUser?.UF_DEPARTMENT
        const bitrixDepartmentIds = Array.isArray(rawDepts)
          ? rawDepts.map(String).filter(Boolean)
          : []

        const response = await axios.post(`${envConfig.apiUrl}/auth`, {
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

        const dataRedirect = getAppRedirectUrl(appCode)

        if (!dataRedirect) {
          setAuthError('Aplicação não configurada para o app: ' + appCode)
          setAuthRedirecting(false)
          return
        }

        const authToken = response.data?.result?.token
        sessionStorage.setItem(dataRedirect.storageAuthTokenKey, authToken)

        const errorMessage = response.data?.error?.message
        if (!response.data || !authToken) {
          setAuthError(errorMessage ?? 'Falha ao autenticar no backend.')
          setAuthRedirecting(false)
          return
        }

        if (cancelled) return

        router.push(dataRedirect.baseRedirectUrl)
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : 'Erro ao autenticar.')
        }
      } finally {
        if (!cancelled) setAuthRedirecting(false)
      }
    }

    void runAuthAndRedirect()
    return () => {
      cancelled = true
    }
  }, [scriptLoaded, bx24Ready])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      {authRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-600">
              Autenticando e redirecionando...
            </p>
          </div>
        </div>
      )}
      {authError && (
        <div className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Erro na autenticação</p>
          <p className="mt-1 text-sm">{authError}</p>
        </div>
      )}
    </div>
  )
}
