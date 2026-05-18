'use client'

import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { useEffect } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from './config'

function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const stored =
      localStorage.getItem(LOCALE_COOKIE) ??
      document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1]
    return stored && (LOCALES as readonly string[]).includes(stored)
      ? stored
      : null
  } catch {
    return null
  }
}

export const i18n = i18next.createInstance()

void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../messages/${language}/${namespace}.json`),
    ),
  )
  .init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  })

export function setLocale(code: string): void {
  const locale = (LOCALES as readonly string[]).includes(code)
    ? code
    : DEFAULT_LOCALE
  try {
    localStorage.setItem(LOCALE_COOKIE, locale)
  } catch {
    // iframe sandboxado sem acesso a localStorage
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=None; Secure`
  void i18n.changeLanguage(locale)
}

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  useEffect(() => {
    void i18n.changeLanguage(readStoredLocale() ?? locale)
  }, [locale])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
