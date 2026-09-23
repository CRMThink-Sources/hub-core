import { appTokenKey } from '@/shared/auth/app-token-storage'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

interface ISessionProviderProps {
  appCode: string
  children: React.ReactNode
}

/**
 * **Legado.** Sobrevive apenas para os dados agregados por app que ainda não têm
 * endpoint próprio: `connectors`, `googleConnection`, `imports`, `biconnectors`.
 *
 * Identidade da instalação e billing saíram daqui — use `AplicationProvider`
 * (`/api/application/me`). Permissões do thinkzap saíram daqui — use
 * `ThinkzapAccessProvider` (`/api/thinkzap/access/me`). Este provider morre na
 * change que quebrar os handlers de sessão em endpoints.
 */
type ISession = {
  [key: string]: any
  refreshSession: () => Promise<void>
}

interface ISessionContext {
  session: ISession | null
  isFetching: boolean
  refreshSession: () => Promise<void>
}

const context = createContext<ISessionContext>({
  session: null,
  isFetching: false,
  refreshSession: () => Promise.resolve(),
})

const useSession = () => {
  const ctx = useContext(context)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}

const createSessionClient = (authTokenKey: string) => {
  const token = sessionStorage.getItem(authTokenKey)
  if (!token) {
    throw new Error('Token not found')
  }
  const axiosInstance = axios.create({
    baseURL: envConfig.apiUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  })

  axiosInstance.interceptors.response.use(
    response => response.data.result,
    error =>
      Promise.reject(
        error instanceof Error ? error : new Error('Request failed'),
      ),
  )

  return axiosInstance
}

const SessionProvider = ({ appCode, children }: ISessionProviderProps) => {
  const [session, setSession] = useState<ISession | null>(null)
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const pathname = usePathname()

  useEffect(() => {
    const client = createSessionClient(appTokenKey(appCode))
    const controller = new AbortController()

    setIsFetching(true)
    client
      .get<ISession>(`/auth/session`, { signal: controller.signal } as any)
      .then(data => setSession(data as any))
      .catch(err => {
        if (!axios.isCancel(err)) {
          console.error('fetchSession error:', err)
        }
      })
      .finally(() => setIsFetching(false))

    return () => controller.abort()
  }, [appCode, pathname])

  const refreshSession = async () => {
    const client = createSessionClient(appTokenKey(appCode))
    try {
      setIsFetching(true)
      const data = await client.get<ISession>(`/auth/session`)
      setSession(data as any)
    } catch (err) {
      console.error('refreshSession error:', err)
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <context.Provider value={{ session, isFetching, refreshSession }}>
      {children}
    </context.Provider>
  )
}

export { SessionProvider, useSession }
