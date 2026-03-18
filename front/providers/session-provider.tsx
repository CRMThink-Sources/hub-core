import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { createContext, useContext, useEffect, useState } from 'react'

interface ISessionProviderProps {
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

const SessionProvider = ({ children }: ISessionProviderProps) => {
  const [session, setSession] = useState<ISession | null>(null)

  useEffect(() => {
    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) {
      throw new Error('Auth token key not found')
    }
    const client = axiosThinkzap(authTokenKey)

    const fetchSession = async () => {
      const data = await client.get<ISession>(`/auth/session`)
      setSession(data as any)
    }
    void fetchSession()
  }, [])

  return <context.Provider value={{ session }}>{children}</context.Provider>
}

export { SessionProvider, useSession }
