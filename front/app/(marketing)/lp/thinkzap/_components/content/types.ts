/**
 * Tipos da copy da LP do ThinkZap. A estrutura (slugs, telas, variantes, ids de
 * menus e abas) é a mesma nos dois idiomas e mora aqui; os dicionários `pt/` e
 * `en/` preenchem `LpContent` com o texto.
 */
import type { ApiOficialCopy } from './pt/tutorials/api-oficial'
import type { AtivacaoCopy } from './pt/tutorials/ativacao'
import type { GruposCopy } from './pt/tutorials/grupos'
import type { InstalacaoCopy } from './pt/tutorials/instalacao'
import type { RobosCopy } from './pt/tutorials/robos'
import type { ThinkbotCopy } from './pt/tutorials/thinkbot'

export const LP_LOCALES = ['pt', 'en'] as const
export type LpLocale = (typeof LP_LOCALES)[number]

export type FeatureIcon =
  | 'channels'
  | 'lines'
  | 'buttons'
  | 'templates'
  | 'automation'
  | 'stats'
  | 'permissions'
  | 'media'

/**
 * Tutoriais da seção "Tutoriais": cada um é uma simulação clicável que espelha o
 * fluxo e os textos reais do app e do Bitrix24. `screen` é o id da tela que
 * `tutorials/<slug>.tsx` desenha; `action` é o rótulo acessível do elemento
 * destacado que o visitante clica. Se o fluxo mudar no app, mude aqui e no
 * arquivo de telas do tutorial.
 */
export type TutorialStep<Screen extends string = string> = {
  screen: Screen
  title: string
  description: string
  action: string
}

/** Uma sequência de passos com a tela de conclusão. */
export type TutorialTrack<Screen extends string = string> = {
  /** Uma frase abaixo das abas, dizendo o que o tutorial cobre. */
  summary: string
  steps: TutorialStep<Screen>[]
  done: { title: string; description: string }
}

/** Variante de um tutorial, escolhida no submenu da aba. */
export type TutorialVariant<Screen extends string = string> =
  TutorialTrack<Screen> & {
    /** Sufixo da âncora: `#tutorial-<slug>-<key>`. */
    key: string
    /** Texto do submenu. */
    label: string
  }

/**
 * Tutorial de uma aba: uma trilha só ou, com `variants`, um submenu com uma
 * trilha por variante (a primeira abre por padrão).
 */
export type Tutorial<Screen extends string = string> = {
  slug: TutorialSlug
  /** Texto da aba. */
  label: string
} & (
  | (TutorialTrack<Screen> & { variants?: undefined })
  | { variants: TutorialVariant<Screen>[] }
)

/** Trilhas de um tutorial: as variantes ou a trilha única (sem `key`). */
export function tutorialTracks(tutorial: Tutorial): TutorialVariant[] {
  if (tutorial.variants) return tutorial.variants
  const { summary, steps, done, label } = tutorial
  return [{ key: '', label, summary, steps, done }]
}

export const TUTORIAL_SLUGS = [
  'instalacao',
  'ativacao',
  'thinkbot',
  'api-oficial',
  'robos',
  'grupos',
] as const
export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number]

export type InstalacaoScreen = 'market' | 'install'

export type AtivacaoScreen =
  | 'trial'
  | 'contact'
  | 'lines'
  | 'qrcode'
  | 'connected'
  | 'channel'
  | 'chat'

export type ThinkbotScreen =
  | 'empty'
  | 'new-flow'
  | 'editor'
  | 'kind-menu'
  | 'block-panel'
  | 'simulator-start'
  | 'simulator-chat'
  | 'publish'
  | 'bind'
  | 'bot-chat'

export type ApiOficialScreen =
  | 'lines'
  | 'new-line'
  | 'pending-line'
  | 'connect'
  | 'connected'
  | 'templates'
  | 'template-form'
  | 'template-pending'
  | 'crm-send'

export type RobosScreen =
  | 'kanban'
  | 'stages'
  | 'catalog'
  | 'robot-form'
  | 'catalog-template'
  | 'template-form'
  | 'move-deal'
  | 'result'
  | 'result-template'

export type GruposScreen =
  | 'groups-tab'
  | 'groups-list'
  | 'group-form'
  | 'group-ready'
  | 'group-created'
  | 'group-chat'

// ─── Ids das peças simuladas (não se traduzem; o rótulo vem da copy) ────────

export const BITRIX_MENU_IDS = [
  'crm',
  'openChannels',
  'thinkzap',
  'market',
] as const
export type BitrixMenuId = (typeof BITRIX_MENU_IDS)[number]

/** Ordem do menu do app, a mesma de `THINKZAP_ASIDE_CONFIG`. */
export const APP_MENU_IDS = [
  'home',
  'conexoes',
  'administracao',
  'thinkbot',
  'logs',
  'ajuda',
] as const
export type AppMenuId = (typeof APP_MENU_IDS)[number]

export type LineProvider = 'web' | 'oficial'
export type LineTabId = 'conexao' | 'grupos' | 'templates' | 'ajustes'

export const DEAL_TAB_IDS = [
  'geral',
  'produtos',
  'thinkzap',
  'historico',
] as const
export type DealTabId = (typeof DEAL_TAB_IDS)[number]

export const STAGE_IDS = ['novo', 'proposta', 'negociacao', 'fechado'] as const
export type StageId = (typeof STAGE_IDS)[number]

// ─── Dicionário ────────────────────────────────────────────────────────────

export type LpContent = {
  locale: LpLocale
  /** Valor do atributo `lang` do conteúdo. */
  htmlLang: string
  metadata: { title: string; description: string; ogLocale: string }
  /** Mensagem pré-preenchida do botão de WhatsApp. */
  whatsappMessage: string
  nav: {
    features: string
    tutorials: string
    faq: string
    install: string
  }
  languageSwitch: { label: string }
  hero: { eyebrow: string; title: string; subtitle: string }
  chatPreview: {
    contactDetail: string
    messages: {
      question: string
      answer: string
      ask: string
      options: [string, string]
      reply: string
    }
    /** Aviso do robô, com a etapa em negrito no meio. */
    robot: { before: string; stage: string }
  }
  features: {
    title: string
    subtitle: string
    items: { icon: FeatureIcon; title: string; description: string }[]
  }
  tutorialsSection: { title: string; subtitle: string }
  player: {
    tabsLabel: string
    variantsLabel: (tutorial: string) => string
    done: string
    stepOf: (step: number, total: number) => string
    /** "Clique no destaque laranja da tela:" — seguido do rótulo da ação. */
    hint: string
    back: string
    next: string
    finish: string
    goToStep: (step: number, title: string) => string
    restart: string
    nextTutorial: (label: string) => string
  }
  /** Molduras e peças comuns às telas dos tutoriais (`tutorials/shared/`). */
  frame: {
    bitrixMenu: Record<BitrixMenuId, string>
    appMenu: Record<AppMenuId, string>
    poweredBy: string
    beta: string
    /** Domínio de exemplo na barra de endereço, sem a barra final. */
    portalHost: string
  }
  shared: {
    conexoesTitle: string
    conexoesSubtitle: string
    providerLabel: Record<LineProvider, string>
    activeLines: (count: string) => string
    tableName: string
    tableStatus: string
    lineTabs: Record<LineTabId, string>
    defaultLineName: string
    backToConnections: string
    connected: string
    disconnected: string
    webHint: string
    oficialHint: string
    deal: { title: string; contact: string; value: string }
    dealLabel: (id: number, value: string) => string
    dealTabs: Record<DealTabId, string>
    stages: Record<StageId, string>
    dealsTitle: string
    filterSearch: string
  }
  tutorials: {
    instalacao: InstalacaoCopy
    ativacao: AtivacaoCopy
    thinkbot: ThinkbotCopy
    'api-oficial': ApiOficialCopy
    robos: RobosCopy
    grupos: GruposCopy
  }
  faq: {
    title: string
    /** `link` opcional: âncora dentro da LP, mostrada depois da resposta. */
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
