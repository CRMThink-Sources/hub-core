'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { createNumberFormatter } from './number-format'

/** Formatador de números no idioma ativo; troca junto com o idioma do app. */
export function useNumberFormatter(): Intl.NumberFormat {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  return useMemo(() => createNumberFormatter(language), [language])
}
