'use client'

import {
  authenticateBitrixWithBackend,
  BX24Script,
  getBitrixAppInfoFromUrl,
  useBX24,
} from '@/bitrix'
import { SessionProvider } from '@/providers/session-provider'
import { useEffect, useState } from 'react'
import { ConversationView } from '../../layouts/conversation-view'

export default function ConversationsPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [appCode, setAppCode] = useState<string | null>(null)

  useEffect(() => {
    if (!scriptLoaded || !bx24Ready || typeof window === 'undefined') return

    const urlInfo = getBitrixAppInfoFromUrl()
    if (!urlInfo.domain) return

    let cancelled = false

    const authenticate = async () => {
      setIsAuthenticating(true)
      setAuthError(null)

      const result = await authenticateBitrixWithBackend()
      if (cancelled) return

      if (!result.ok) {
        setAuthError(result.error)
        setIsAuthenticating(false)
        return
      }

      sessionStorage.setItem(result.storageAuthTokenKey, result.token)
      setAppCode(result.appCode)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
    }

    void authenticate()

    window.BX24?.fitWindow?.(() => {
      window.BX24?.resizeWindow?.(600, 800)
    })

    return () => {
      cancelled = true
    }
  }, [scriptLoaded, bx24Ready])

  return (
    <div>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      {isAuthenticating && (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-600">Autenticando...</p>
          </div>
        </div>
      )}
      {authError && (
        <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Erro na autenticação</p>
          <p className="mt-1 text-sm">{authError}</p>
        </div>
      )}
      {isAuthenticated && appCode && (
        <SessionProvider appCode={appCode}>
          <ConversationView />
        </SessionProvider>
      )}
    </div>
  )
}
