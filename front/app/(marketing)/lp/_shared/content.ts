export const LP_LOCALES = ['pt', 'en', 'es'] as const
export type LpLocale = (typeof LP_LOCALES)[number]

export const DEFAULT_LP_LOCALES = ['pt', 'en'] as const
export type DefaultLpLocale = (typeof DEFAULT_LP_LOCALES)[number]

// `?lang=` repetido chega como array e cai em pt; por isso `supported` precisa incluir `pt`.
export function resolveLpLocale<L extends LpLocale = DefaultLpLocale>(
  raw: unknown,
  supported: readonly L[] = DEFAULT_LP_LOCALES as readonly LpLocale[] as readonly L[],
): L {
  return (supported as readonly unknown[]).includes(raw)
    ? (raw as L)
    : ('pt' as L)
}

export function localizedLpPath(basePath: string, locale: LpLocale): string {
  return locale === 'pt' ? basePath : `${basePath}?lang=${locale}`
}

export type TutorialStep<Screen extends string = string> = {
  screen: Screen
  title: string
  description: string
  action: string
}

export type TutorialTrack<Screen extends string = string> = {
  summary: string
  steps: TutorialStep<Screen>[]
  done: { title: string; description: string }
}

export type TutorialVariant<Screen extends string = string> =
  TutorialTrack<Screen> & {
    key: string
    label: string
  }

export type Tutorial<
  Screen extends string = string,
  Slug extends string = string,
> = {
  slug: Slug
  label: string
} & (
  | (TutorialTrack<Screen> & { variants?: undefined })
  | { variants: TutorialVariant<Screen>[] }
)

export function tutorialTracks(
  tutorial: Tutorial<string, string>,
): TutorialVariant[] {
  if (tutorial.variants) return tutorial.variants
  const { summary, steps, done, label } = tutorial
  return [{ key: '', label, summary, steps, done }]
}

export const BITRIX_MENU_IDS = ['crm', 'openChannels', 'app', 'market'] as const
export type BitrixMenuId = (typeof BITRIX_MENU_IDS)[number]

export type LpFrameCopy = {
  bitrixMenu: Record<BitrixMenuId, string>
  /** Sem a barra final. */
  portalHost: string
}

export type LpFeaturesCopy<Icon extends string = string> = {
  title: string
  subtitle: string
  items: { icon: Icon; title: string; description: string }[]
}

export type LpBaseContent<
  FeatureIcon extends string = string,
  Locale extends LpLocale = LpLocale,
> = {
  locale: Locale
  htmlLang: string
  metadata: { title: string; description: string; ogLocale: string }
  whatsappMessage: string
  nav: {
    features: string
    tutorials: string
    faq: string
    install: string
  }
  languageSwitch: { label: string }
  features: LpFeaturesCopy<FeatureIcon>
  tutorialsSection: { title: string; subtitle: string }
  player: {
    tabsLabel: string
    variantsLabel: (tutorial: string) => string
    done: string
    stepOf: (step: number, total: number) => string
    hint: string
    back: string
    next: string
    finish: string
    goToStep: (step: number, title: string) => string
    restart: string
    nextTutorial: (label: string) => string
  }
  frame: LpFrameCopy
  faq: {
    title: string
    items: {
      question: string
      answer: string
      link?: { href: string; label: string }
    }[]
  }
  finalCta: { title: string; subtitle: string; fallback: string }
  ctaButtons: { install: string; whatsapp: string }
  footer: (year: number) => string
}
