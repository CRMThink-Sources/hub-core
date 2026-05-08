'use client'

import { createContext, useContext, useState } from 'react'

interface ILoadingContext {
  isLoading: boolean
  loadingMessage: string
  setLoading: (loading: boolean, message?: string) => void
}

const context = createContext<ILoadingContext>({
  isLoading: false,
  loadingMessage: 'Salvando...',
  setLoading: () => {},
})

const useLoading = () => {
  const ctx = useContext(context)
  if (!ctx) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return ctx
}

const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Salvando...')

  function setLoading(loading: boolean, message = 'Salvando...') {
    setIsLoading(loading)
    setLoadingMessage(message)
  }

  return (
    <context.Provider value={{ isLoading, loadingMessage, setLoading }}>
      {children}
    </context.Provider>
  )
}

export { LoadingProvider, useLoading }
