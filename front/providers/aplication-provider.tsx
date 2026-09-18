'use client'

import axios from 'axios'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { readAppToken } from '@/shared/auth/app-token-storage'
import { envConfig } from '@/shared/infra/env-config'
import {
  loadAplicationContext,
  type AplicationContextState,
  type HttpOutcome,
} from '@/shared/aplication/aplication-context'

/**
 * Contexto da instalação a partir de `GET /api/application/me`.
 *
 * Substitui `session.app` e `session.subscription` como fonte de identidade e
 * billing. Duas diferenças em relação ao `SessionProvider`:
 *
 * - **Uma leitura por app, não por rota.** O `SessionProvider` tem `pathname` na
 *   dependência do efeito, então cada navegação refaz o agregado — que no
 *   thinkzap significa chamadas Z-API/HubMessage/Bitrix por conector.
 * - **Falha não vira contexto vazio.** Ver `AplicationContextState`.
 *
 * Ver spec `aplication-context-provider`.
 */
type AplicationContextValue = {
  state: AplicationContextState
  refresh: () => Promise<void>
}

const context = createContext<AplicationContextValue>({
  state: { status: 'loading' },
  refresh: () => Promise.resolve(),
})

export const useAplicationContext = (): AplicationContextValue =>
  useContext(context)

/** Atalho para o caso comum: contexto carregado ou nada. */
export function useAplication() {
  const { state } = useAplicationContext()
  return state.status === 'ready' ? state : null
}

const request =
  (signal?: AbortSignal) =>
  async (token: string): Promise<HttpOutcome> => {
    try {
      const response = await axios.get(`${envConfig.apiUrl}/application/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          /**
           * Sem isto, o ngrok free tier responde com a página de aviso de
           * "visitante" (HTML, sem CORS) — nunca chega no processo real.
           */
          'ngrok-skip-browser-warning': 'true',
        },
        signal,
      })
      return { kind: 'ok', data: response.data?.result }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const message =
          (err.response?.data as { result?: { error?: string } } | undefined)
            ?.result?.error ?? err.message
        if (status) return { kind: 'status', status, message }
        return { kind: 'network', message }
      }
      return {
        kind: 'network',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      }
    }
  }

export function AplicationProvider({
  appCode,
  children,
}: {
  appCode: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<AplicationContextState>({
    status: 'loading',
  })

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const next = await loadAplicationContext({
        readToken: () => readAppToken(appCode),
        request: request(signal),
      })
      if (signal?.aborted) return
      setState(next)
    },
    [appCode],
  )

  // Dependência é `appCode` — **não** `pathname`. Navegar dentro da app não
  // refaz a leitura.
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const value = useMemo(() => ({ state, refresh }), [state, refresh])

  return <context.Provider value={value}>{children}</context.Provider>
}
