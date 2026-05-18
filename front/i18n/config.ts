export const LOCALES = ['pt', 'en', 'es']
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt'
export const LOCALE_COOKIE = 'hub_locale'
