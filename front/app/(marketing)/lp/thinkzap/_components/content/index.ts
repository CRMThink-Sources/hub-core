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

/**
 * Idioma da LP a partir do `?lang=`. Só `en` muda o idioma; ausente, `pt`,
 * inválido ou repetido (`?lang=en&lang=pt` chega como array) fica em português.
 */
export function resolveLpLocale(raw: unknown): LpLocale {
  return raw === 'en' ? 'en' : 'pt'
}

export function getLpContent(locale: LpLocale): LpContent {
  return CONTENT[locale]
}

/** Tutoriais na ordem das abas. */
export function tutorialsOf(content: LpContent): Tutorial[] {
  return TUTORIAL_SLUGS.map(slug => content.tutorials[slug].tutorial)
}

/** Caminho da LP em cada idioma; português é a URL sem parâmetro. */
export function lpPath(locale: LpLocale): string {
  return locale === 'en' ? '/lp/thinkzap?lang=en' : '/lp/thinkzap'
}
