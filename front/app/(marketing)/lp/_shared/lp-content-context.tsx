'use client'

import { createContext, useContext } from 'react'
import type { LpBaseContent } from './content'

const LpContentContext = createContext<LpBaseContent | null>(null)

export function LpContentProvider({
  content,
  children,
}: {
  content: LpBaseContent
  children: React.ReactNode
}) {
  return (
    <LpContentContext.Provider value={content}>
      {children}
    </LpContentContext.Provider>
  )
}

export function useLpBaseContent(): LpBaseContent {
  const content = useContext(LpContentContext)
  if (!content) throw new Error('useLpBaseContent fora do LpContentProvider')
  return content
}

// Sem provider (testes com tela solta) vale `fallback`.
export function createLpContentHook<Content extends LpBaseContent>(
  fallback: Content,
) {
  return function useLpContent(): Content {
    return (useContext(LpContentContext) as Content | null) ?? fallback
  }
}
