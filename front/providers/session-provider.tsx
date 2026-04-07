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
  connectors: any[]
}

const context = createContext<{
  session: ISession | null
}>({ session: null })

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
  const pathname = usePathname()

  useEffect(() => {
    const authTokenKey = getAppRedirectUrl(appCode)?.storageAuthTokenKey
    if (!authTokenKey) {
      throw new Error('Auth token key not found')
    }
    const client = createSessionClient(authTokenKey)

    const fetchSession = async () => {
      try {
        const data = await client.get<ISession>(`/auth/session`)
        // console.log('session data:', data)
        setSession(data as any)
      } catch (err) {
        console.error('fetchSession error:', err)
      }
    }
    void fetchSession()
  }, [appCode, pathname])

  return <context.Provider value={{ session }}>{children}</context.Provider>
}

export { SessionProvider, useSession }
