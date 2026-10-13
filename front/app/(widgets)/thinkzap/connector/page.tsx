'use client'

import {
  authenticateBitrixWithBackend,
  BX24Script,
  isInsideIframe,
  useBX24,
} from '@/bitrix'
import { ContactCenterView } from '@/components/layouts/widgets/contact-center'
import { BitrixOnlyNotice } from '@/app/(thinkzap)/thinkzap/_components/bitrix-only-notice'
import { writeAppToken } from '@/shared/auth/app-token-storage'
import { envConfig } from '@/shared/infra/env-config'
import { useEffect, useState } from 'react'

/**
 * `/thinkzap/connector` é o `PLACEMENT_HANDLER` do conector, gravado em
 * `imconnector.register` de todas as instalações — a URL não pode mudar.
 *
 * Vive em `(widgets)`, e não em `(thinkzap)`, porque o layout do app monta
 * `SessionProvider`, que lança `Token not found` quando o iframe do Contact Center
 * abre sem token — e só esta página autentica. Aqui o token é gravado antes de
 * montar qualquer coisa que chame a API, igual a `/widgets/conversations`.
 */
type Embedding = 'checking' | 'inside' | 'outside'

export default function ContactCenterConnectorPage() {
  const [embedding, setEmbedding] = useState<Embedding>('checking')
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready, error: bx24Error } = useBX24(scriptLoaded)
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    setEmbedding(isInsideIframe() ? 'inside' : 'outside')
  }, [])

  useEffect(() => {
    if (!ready) return

    let cancelled = false

    const authenticate = async () => {
      const result = await authenticateBitrixWithBackend()
      if (cancelled) return

      if (!result.ok) {
        setAuthError(result.error)
        return
      }

      writeAppToken(result.app.appCode, result.token)
      setAuthenticated(true)
    }

    void authenticate()

    return () => {
      cancelled = true
    }
  }, [ready])

  if (embedding === 'outside') {
    return (
      <div className="theme-thinkzap">
        <BitrixOnlyNotice marketUrl={envConfig.thinkzapMarketUrl} />
      </div>
    )
  }

  const error = authError ?? bx24Error

  return (
    <div>
      {embedding === 'inside' && (
        <BX24Script onLoad={() => setScriptLoaded(true)} />
      )}
      {error ? (
        <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Erro na autenticação</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : authenticated ? (
        <ContactCenterView />
      ) : (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-sm text-neutral-600">Autenticando...</p>
          </div>
        </div>
      )}
    </div>
  )
}
