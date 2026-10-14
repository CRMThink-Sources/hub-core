import type { LpBaseContent, LpLocale } from './content'
import { LanguageSwitch } from './language-switch'
import type { LpCtas } from './resolve-ctas'
import { TUTORIALS_SECTION_ID } from './tutorial-hash'

export function LpHeader({
  logo,
  basePath,
  marketUrl,
  content,
  locales,
}: Pick<LpCtas, 'marketUrl'> & {
  logo: React.ReactNode
  basePath: string
  content: Pick<LpBaseContent, 'locale' | 'nav' | 'languageSwitch'>
  locales?: readonly LpLocale[]
}) {
  const { nav } = content
  return (
    <header className="border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        {logo}
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#funcionalidades" className="hover:text-foreground">
            {nav.features}
          </a>
          <a
            href={`#${TUTORIALS_SECTION_ID}`}
            className="hover:text-foreground"
          >
            {nav.tutorials}
          </a>
          <a href="#duvidas" className="hover:text-foreground">
            {nav.faq}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitch
            locale={content.locale}
            label={content.languageSwitch.label}
            basePath={basePath}
            locales={locales}
          />
          {marketUrl && (
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {nav.install}
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
