import Image from 'next/image'
import {
  ArrowRight,
  Blocks,
  Check,
  Handshake,
  Languages,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { LanguageSwitch } from '../lp/_shared/language-switch'
import { localizedLpPath } from '../lp/_shared/content'
import { HUB_APP_IDS, HUB_APPS, type HubApp } from './apps'
import { HOME_BASE_PATH, HOME_LOCALES, type HomeContent } from './content'
import type { HubPillarIcon } from './content/types'
import { HubDiagram } from './hub-diagram'

const APPS_SECTION_ID = 'apps'
const WHY_SECTION_ID = 'por-que'

const PILLAR_ICONS: Record<HubPillarIcon, LucideIcon> = {
  bitrix: Blocks,
  market: Store,
  support: Handshake,
  languages: Languages,
}

export function HomeHeader({ content }: { content: HomeContent }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Image
          src="/images/thinkhub/logo.png"
          alt="Think Hub"
          width={1045}
          height={362}
          priority
          className="h-9 w-auto"
        />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href={`#${APPS_SECTION_ID}`} className="hover:text-foreground">
            {content.nav.apps}
          </a>
          <a href={`#${WHY_SECTION_ID}`} className="hover:text-foreground">
            {content.nav.why}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitch
            locale={content.locale}
            label={content.languageSwitch.label}
            basePath={HOME_BASE_PATH}
            locales={HOME_LOCALES}
          />
          <a
            href={`#${APPS_SECTION_ID}`}
            className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-flex"
          >
            {content.nav.cta}
          </a>
        </div>
      </div>
    </header>
  )
}

export function HomeHero({ content }: { content: HomeContent }) {
  const { hero } = content
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 size-[36rem] rounded-full bg-linear-to-br from-violet-400/20 to-cyan-300/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {hero.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {hero.title}{' '}
            <span className="bg-linear-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
              {hero.highlight}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`#${APPS_SECTION_ID}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {hero.primary}
              <ArrowRight className="size-4" />
            </a>
            <a
              href={`#${WHY_SECTION_ID}`}
              className="inline-flex items-center justify-center rounded-lg border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-accent"
            >
              {hero.secondary}
            </a>
          </div>
        </div>
        <HubDiagram label={hero.diagramLabel} />
      </div>
    </section>
  )
}

export function HomeApps({ content }: { content: HomeContent }) {
  const { apps } = content
  return (
    <section
      id={APPS_SECTION_ID}
      className="scroll-mt-20 bg-muted/60 px-4 py-16 sm:px-6 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {apps.title}
          </h2>
          <p className="mt-3 text-muted-foreground">{apps.subtitle}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HUB_APP_IDS.map(id => (
            <AppCard
              key={id}
              app={HUB_APPS[id]}
              copy={apps.items[id]}
              content={content}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function AppCard({
  app,
  copy,
  content,
}: {
  app: HubApp
  copy: HomeContent['apps']['items'][HubApp['id']]
  content: HomeContent
}) {
  const href = app.lpBasePath
    ? localizedLpPath(app.lpBasePath, content.locale)
    : null

  return (
    <article
      className={`${app.themeClass} group relative flex flex-col rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-lg`}
    >
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-primary" />
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <app.Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{app.name}</h3>
          <p className="text-sm text-primary">{copy.tagline}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{copy.description}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {copy.highlights.map(item => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        {href ? (
          <a
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary after:absolute after:inset-0 after:rounded-2xl"
          >
            {content.apps.learnMore(app.name)}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : (
          <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {content.apps.comingSoon}
          </span>
        )}
      </div>
    </article>
  )
}

export function HomeWhy({ content }: { content: HomeContent }) {
  const { why } = content
  return (
    <section
      id={WHY_SECTION_ID}
      className="scroll-mt-20 px-4 py-16 sm:px-6 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {why.title}
          </h2>
          <p className="mt-3 text-muted-foreground">{why.subtitle}</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {why.items.map(item => {
            const Icon = PILLAR_ICONS[item.icon]
            return (
              <div key={item.icon}>
                <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-cyan-400 text-white shadow-sm">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function HomeFinalCta({ content }: { content: HomeContent }) {
  const copy = content.finalCta
  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-5xl rounded-2xl bg-linear-to-br from-violet-600 via-blue-600 to-cyan-500 px-6 py-12 text-center text-white sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-white/85">{copy.subtitle}</p>
        <a
          href={`#${APPS_SECTION_ID}`}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-white/90"
        >
          {copy.button}
          <ArrowRight className="size-4" />
        </a>
      </div>
    </section>
  )
}

export function HomeFooter({ content }: { content: HomeContent }) {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>{content.footer(new Date().getFullYear())}</p>
    </footer>
  )
}
