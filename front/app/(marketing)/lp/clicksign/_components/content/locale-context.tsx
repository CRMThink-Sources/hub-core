'use client'

import { createLpContentHook } from '../../../_shared/lp-content-context'
import { PT } from './pt'
import type { LpContent, TutorialSlug } from './types'

export { LpContentProvider } from '../../../_shared/lp-content-context'

// Sem provider (testes com tela solta) cai no português.
export const useLpContent = createLpContentHook<LpContent>(PT)

export function useTutorialScreens<Slug extends TutorialSlug>(
  slug: Slug,
): LpContent['tutorials'][Slug]['screens'] {
  return useLpContent().tutorials[slug].screens
}
