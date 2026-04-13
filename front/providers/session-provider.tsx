import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

interface ISessionProviderProps {
  appCode: string
  children: React.ReactNode
}

type ISession = {
  app: any
  [key: string]: any
  refreshSession: () => Promise<void>
}

const context = createContext<{
  session: ISession | null
  refreshSession: () => Promise<void>
}>({ session: null, refreshSession: () => Promise.resolve() })

const useSession = () => {
  const session = useContext(context)
  if (!session) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return session
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
    const authTokenKey = getAppRedirectUrl(appCode)?.storageAuthTokenKey
    if (!authTokenKey) {
      throw new Error('Auth token key not found')
    }
    const client = createSessionClient(authTokenKey)

    const fetchSession = async () => {
      try {
        setIsFetching(true)
        const data = await client.get<ISession>(`/auth/session`)
        // console.log('session data:', data)
        setSession(data as any)
      } catch (err) {
        console.error('fetchSession error:', err)
      } finally {
        setIsFetching(false)
      }
    }
    void fetchSession()
  }, [appCode, pathname])

  const refreshSession = async () => {
    const authTokenKey = getAppRedirectUrl(appCode)?.storageAuthTokenKey
    if (!authTokenKey) {
      throw new Error('Auth token key not found')
    }
    const client = createSessionClient(authTokenKey)
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
    <context.Provider value={{ session, refreshSession }}>
      {isFetching ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          <span className="text-sm font-medium text-slate-600">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="animate-pulse">Carregando sessão...</span>
          </span>
        </div>
      ) : (
        children
      )}
    </context.Provider>
  )
}

export { SessionProvider, useSession }
