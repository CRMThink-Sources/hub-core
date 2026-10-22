import {
  LP_LOCALES,
  localizedLpPath,
  resolveLpLocale,
  type LpLocale,
} from '../../lp/_shared/content'
import { en } from './en'
import { es } from './es'
import { pt } from './pt'
import type { HomeContent } from './types'

export type { HomeContent } from './types'

export const HOME_BASE_PATH = '/'
export const HOME_LOCALES = LP_LOCALES

const CONTENT: Record<LpLocale, HomeContent> = { pt, en, es }

export function resolveHomeLocale(raw: unknown): LpLocale {
  return resolveLpLocale<LpLocale>(raw, HOME_LOCALES)
}

export function getHomeContent(locale: LpLocale): HomeContent {
  return CONTENT[locale]
}

export function homePath(locale: LpLocale): string {
  return localizedLpPath(HOME_BASE_PATH, locale)
}
