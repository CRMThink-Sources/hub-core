'use client'

import { useTranslation } from 'react-i18next'
import { setLocale } from '@/i18n/provider'

const LANGUAGES = [
  { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
  { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
  { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
] as const

export function InstallLanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="absolute left-4 top-4 flex items-center gap-2">
      {LANGUAGES.map(({ code, flag }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-label={code}
          aria-pressed={i18n.language === code}
          className={`cursor-pointer rounded-sm transition hover:opacity-100 ${
            i18n.language === code
              ? 'opacity-100 ring-2 ring-white'
              : 'opacity-50'
          }`}
        >
          <img src={flag} alt="" className="h-5 w-5 rounded-sm" />
        </button>
      ))}
    </div>
  )
}
