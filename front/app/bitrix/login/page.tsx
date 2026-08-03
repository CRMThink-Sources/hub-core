'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  authenticateBitrixWithBackend,
  BX24Script,
  getBitrixAppInfoFromUrl,
  registerOperatorOAuth,
  useBX24,
} from '@/bitrix'
import { appRoute } from '@/shared/app/app-codes'
import { writeAppToken } from '@/shared/auth/app-token-storage'

/**
 * Estados do login, explícitos.
 *
 * Antes o componente saía do efeito sem renderizar nada quando faltava `DOMAIN`
 * na URL — abrir a página fora do iframe do Bitrix dava tela branca, sem pista
 * do motivo. Ver spec `app-login-redirect`.
 */
type LoginState =
  | { status: 'loading-bridge' }
  | { status: 'outside-bitrix' }
  | { status: 'authenticating' }
  | { status: 'redirecting' }
  | { status: 'error'; message: string }

export default function BitrixLoginPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)
  const [state, setState] = useState<LoginState>({ status: 'loading-bridge' })
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Fora do iframe não há o que autenticar, e isso é detectável antes do
    // bridge carregar.
    if (!getBitrixAppInfoFromUrl().domain) {
      setState({ status: 'outside-bitrix' })
      return
    }

    if (!scriptLoaded || !bx24Ready) {
      setState({ status: 'loading-bridge' })
      return
    }

    let cancelled = false

    async function runAuthAndRedirect() {
      setState({ status: 'authenticating' })

      const result = await authenticateBitrixWithBackend()
      if (cancelled) return

      if (!result.ok) {
        setState(
          result.reason === 'outside-bitrix'
            ? { status: 'outside-bitrix' }
            : { status: 'error', message: result.error },
        )
        return
      }

      const { token, app, bitrix } = result

      // Chave namespaced por app: duas apps no mesmo navegador não colidem.
      writeAppToken(app.appCode, token)

      // Decisão da flag do catálogo, não de comparação com nome de app.
      if (app.requiresOperatorOAuth) {
        try {
          await registerOperatorOAuth(app.appCode, bitrix)
        } catch (oauthErr) {
          // Não bloqueia: a app funciona sem o OAuth de operador.
          console.warn('Falha ao salvar OAuth do operador:', oauthErr)
        }
      }
      if (cancelled) return

      setState({ status: 'redirecting' })
      router.push(appRoute(app.slug))
    }

    void runAuthAndRedirect()
    return () => {
      cancelled = true
    }
  }, [scriptLoaded, bx24Ready, router])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      {(state.status === 'loading-bridge' ||
        state.status === 'authenticating' ||
        state.status === 'redirecting') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-600">
              {state.status === 'loading-bridge'
                ? 'Conectando ao Bitrix24...'
                : state.status === 'authenticating'
                  ? 'Autenticando...'
                  : 'Redirecionando...'}
            </p>
          </div>
        </div>
      )}

      {state.status === 'outside-bitrix' && (
        <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          <p className="text-sm font-medium">Abra pelo Bitrix24</p>
          <p className="mt-1 text-sm">
            Esta página funciona dentro do Bitrix24. Abra a aplicação pelo menu
            do seu portal.
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Erro na autenticação</p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
      )}
    </div>
  )
}
