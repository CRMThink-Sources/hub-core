'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  authenticateBitrixWithBackend,
  BX24Script,
  getBitrixAppInfoFromUrl,
  useBX24,
} from '@/bitrix'
import { getAppRedirectUrl } from '@/app/config/app-redirects'

export default function Home() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)
  const [authRedirecting, setAuthRedirecting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!scriptLoaded || !bx24Ready || typeof window === 'undefined') return

    const urlInfo = getBitrixAppInfoFromUrl()
    if (!urlInfo.domain) return

    let cancelled = false

    async function runAuthAndRedirect() {
      setAuthRedirecting(true)
      setAuthError(null)

      const result = await authenticateBitrixWithBackend()
      if (cancelled) return

      if (!result.ok) {
        setAuthError(result.error)
        setAuthRedirecting(false)
        return
      }

      sessionStorage.setItem(result.storageAuthTokenKey, result.token)

      const dataRedirect = getAppRedirectUrl(result.appCode)
      if (!dataRedirect) {
        setAuthError(`Aplicação não configurada para o app: ${result.appCode}`)
        setAuthRedirecting(false)
        return
      }

      router.push(dataRedirect.baseRedirectUrl)
      setAuthRedirecting(false)
    }

    void runAuthAndRedirect()
    return () => {
      cancelled = true
    }
  }, [scriptLoaded, bx24Ready, router])

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
