'use client'

import { createContext, useContext } from 'react'
import { PT } from './pt'
import type { LpContent, TutorialSlug } from './types'

/**
 * Copy do idioma para as telas simuladas dos tutoriais, que ficam várias
 * camadas abaixo do player. Sem provider (testes que renderizam uma tela
 * solta) vale o português.
 */
const LpContentContext = createContext<LpContent>(PT)

export function LpContentProvider({
  content,
  children,
}: {
  content: LpContent
  children: React.ReactNode
}) {
  return (
    <LpContentContext.Provider value={content}>
      {children}
    </LpContentContext.Provider>
  )
}

export function useLpContent(): LpContent {
  return useContext(LpContentContext)
}

/** Textos das telas de um tutorial. */
export function useTutorialScreens<Slug extends TutorialSlug>(
  slug: Slug,
): LpContent['tutorials'][Slug]['screens'] {
  return useLpContent().tutorials[slug].screens
}
