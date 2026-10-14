'use client'

import { DEFAULT_LP_LOCALES, localizedLpPath, type LpLocale } from './content'

const LABELS: Record<LpLocale, string> = { pt: 'PT', en: 'EN', es: 'ES' }
const LANGS: Record<LpLocale, string> = { pt: 'pt-BR', en: 'en', es: 'es' }

// O hash não chega ao servidor: com JS o clique leva o `#hash` atual para manter a seção aberta.
export function LanguageSwitch({
  locale,
  label,
  basePath,
  locales = DEFAULT_LP_LOCALES,
}: {
  locale: LpLocale
  label: string
  basePath: string
  locales?: readonly LpLocale[]
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-lg border border-border p-0.5 text-xs font-semibold"
    >
      {locales.map(code =>
        code === locale ? (
          <span
            key={code}
            lang={LANGS[code]}
            aria-current="true"
            className="rounded-md bg-primary px-2 py-1 text-primary-foreground"
          >
            {LABELS[code]}
          </span>
        ) : (
          <a
            key={code}
            href={localizedLpPath(basePath, code)}
            hrefLang={LANGS[code]}
            lang={LANGS[code]}
            onClick={event => {
              const { hash } = window.location
              if (!hash) return
              event.preventDefault()
              window.location.assign(
                `${localizedLpPath(basePath, code)}${hash}`,
              )
            }}
            className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            {LABELS[code]}
          </a>
        ),
      )}
    </div>
  )
}
