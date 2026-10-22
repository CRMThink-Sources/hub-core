import type { LpLocale } from '../../lp/_shared/content'
import type { HubAppId } from '../apps'

export type HubPillarIcon = 'bitrix' | 'market' | 'support' | 'languages'

export type HubAppCopy = {
  tagline: string
  description: string
  highlights: string[]
}

export type HomeContent = {
  locale: LpLocale
  htmlLang: string
  metadata: { title: string; description: string; ogLocale: string }
  languageSwitch: { label: string }
  nav: { apps: string; why: string; cta: string }
  hero: {
    eyebrow: string
    title: string
    highlight: string
    subtitle: string
    primary: string
    secondary: string
    diagramLabel: string
  }
  apps: {
    title: string
    subtitle: string
    learnMore: (name: string) => string
    comingSoon: string
    items: Record<HubAppId, HubAppCopy>
  }
  why: {
    title: string
    subtitle: string
    items: { icon: HubPillarIcon; title: string; description: string }[]
  }
  finalCta: { title: string; subtitle: string; button: string }
  footer: (year: number) => string
}
