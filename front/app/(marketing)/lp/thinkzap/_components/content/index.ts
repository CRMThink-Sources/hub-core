import { localizedLpPath } from '../../../_shared/content'
import { EN } from './en'
import { PT } from './pt'
import {
  TUTORIAL_SLUGS,
  type LpContent,
  type LpLocale,
  type Tutorial,
} from './types'

export * from './types'

const CONTENT: Record<LpLocale, LpContent> = { pt: PT, en: EN }

export function getLpContent(locale: LpLocale): LpContent {
  return CONTENT[locale]
}

export function tutorialsOf(content: LpContent): Tutorial[] {
  return TUTORIAL_SLUGS.map(slug => content.tutorials[slug].tutorial)
}

export const LP_BASE_PATH = '/lp/thinkzap'

export function lpPath(locale: LpLocale): string {
  return localizedLpPath(LP_BASE_PATH, locale)
}
