'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import axios from 'axios'
import { axiosPortal } from '@/infra/client/axios-portal'
import { clearPortalToken, getPortalToken } from '@/lib/portal-auth'

export type PortalSession = {
  id: string
  email: string
  name: string
  role: string
}

type PortalSessionContextValue = {
  session: PortalSession | null
  isFetching: boolean
  refreshSession: () => Promise<void>
  logout: () => void
}

const PortalSessionContext = createContext<PortalSessionContextValue>({
  session: null,
  isFetching: false,
  refreshSession: () => Promise.resolve(),
  logout: () => {},
})

export function usePortalSession() {
  return useContext(PortalSessionContext)
}

export function PortalSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, setSession] = useState<PortalSession | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const pathname = usePathname()

  const fetchSession = async (signal?: AbortSignal) => {
    const token = getPortalToken()
    if (!token) {
      setSession(null)
      setIsFetching(false)
      return
    }

    try {
      setIsFetching(true)
      const client = axiosPortal()
      const data = await client.get<PortalSession>('/portal/auth/session', {
        signal,
      } as Parameters<typeof client.get>[1])
      setSession(data)
    } catch (error) {
      if (!axios.isCancel(error)) {
        clearPortalToken()
        setSession(null)
      }
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void fetchSession(controller.signal)
    return () => controller.abort()
  }, [pathname])

  const refreshSession = async () => {
    await fetchSession()
  }

  const logout = () => {
    clearPortalToken()
    setSession(null)
  }

  return (
    <PortalSessionContext.Provider
      value={{ session, isFetching, refreshSession, logout }}
    >
      {children}
    </PortalSessionContext.Provider>
  )
}
