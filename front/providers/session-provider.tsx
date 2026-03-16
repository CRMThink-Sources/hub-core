import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { createContext, useContext, useEffect, useState } from 'react'

interface ISessionProviderProps {
  children: React.ReactNode
}

interface ISession {
  id: string
  name: string
  email: string
  image: string
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
  const authTokenKey = getAppRedirectUrl(
    envConfig.appCodes.thinkzap,
  )?.storageAuthTokenKey
  if (!authTokenKey) {
    throw new Error('Auth token key not found')
  }
  const axios = axiosThinkzap(authTokenKey)

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await axios.get(`/session`)
    }
    fetchSession()
  }, [])

  return <context.Provider value={{ session }}>{children}</context.Provider>
}

export { SessionProvider, useSession }
