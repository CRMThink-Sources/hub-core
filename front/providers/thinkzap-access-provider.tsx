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
import { APP_CODES } from '@/shared/app/app-codes'
import { readAppToken } from '@/shared/auth/app-token-storage'
import { envConfig } from '@/shared/infra/env-config'
import type { HttpOutcome } from '@/shared/aplication/aplication-context'
import {
  loadThinkzapAccess,
  type ThinkzapAccessState,
} from '@/shared/thinkzap/thinkzap-access-state'

/**
 * Permissões do thinkzap do usuário do token, lidas uma vez por sessão de app.
 *
 * Substitui `session.thinkzapAccess`: o endpoint próprio considera permissão
 * herdada de departamento, que o cálculo dentro de `/auth/session` ignorava.
 * Ver spec `thinkzap-access-query`.
 */
type ThinkzapAccessContextValue = {
  state: ThinkzapAccessState
  refresh: () => Promise<void>
}

const context = createContext<ThinkzapAccessContextValue>({
  state: { status: 'loading' },
  refresh: () => Promise.resolve(),
})

export const useThinkzapAccessState = (): ThinkzapAccessContextValue =>
  useContext(context)

const request =
  (signal?: AbortSignal) =>
  async (token: string): Promise<HttpOutcome> => {
    try {
      const response = await axios.get(
        `${envConfig.apiUrl}/thinkzap/access/me`,
        { headers: { Authorization: `Bearer ${token}` }, signal },
      )
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

export function ThinkzapAccessProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<ThinkzapAccessState>({
    status: 'loading',
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    const next = await loadThinkzapAccess({
      readToken: () => readAppToken(APP_CODES.thinkzap),
      request: request(signal),
    })
    if (signal?.aborted) return
    setState(next)
  }, [])

  // Sem `pathname` na dependência: navegar dentro do thinkzap não refaz a
  // leitura de permissão.
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const value = useMemo(() => ({ state, refresh }), [state, refresh])

  return <context.Provider value={value}>{children}</context.Provider>
}
