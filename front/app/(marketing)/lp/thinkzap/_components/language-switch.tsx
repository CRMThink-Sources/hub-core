'use client'

import { LP_LOCALES, lpPath, type LpLocale } from './content'

const LABELS: Record<LpLocale, string> = { pt: 'PT', en: 'EN' }

/**
 * Seletor PT/EN do header. O idioma atual é texto marcado; o outro é um link
 * comum para a URL do idioma — sem JS ele funciona e cai no topo da página. Com
 * JS, o clique leva junto o `#hash` atual para manter a seção ou o tutorial
 * aberto (o hash não chega ao servidor, então não dá para montá-lo no `href`).
 */
export function LanguageSwitch({
  locale,
  label,
}: {
  locale: LpLocale
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-lg border border-border p-0.5 text-xs font-semibold"
    >
      {LP_LOCALES.map(code =>
        code === locale ? (
          <span
            key={code}
            lang={code === 'en' ? 'en' : 'pt-BR'}
            aria-current="true"
            className="rounded-md bg-primary px-2 py-1 text-primary-foreground"
          >
            {LABELS[code]}
          </span>
        ) : (
          <a
            key={code}
            href={lpPath(code)}
            hrefLang={code === 'en' ? 'en' : 'pt-BR'}
            lang={code === 'en' ? 'en' : 'pt-BR'}
            onClick={event => {
              const { hash } = window.location
              if (!hash) return
              event.preventDefault()
              window.location.assign(`${lpPath(code)}${hash}`)
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
