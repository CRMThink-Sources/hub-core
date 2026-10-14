import type {
  DefaultLpLocale,
  LpBaseContent,
  LpFrameCopy,
  Tutorial as LpTutorial,
} from '../../../_shared/content'
import type { ApiOficialCopy } from './pt/tutorials/api-oficial'
import type { AtivacaoCopy } from './pt/tutorials/ativacao'
import type { GruposCopy } from './pt/tutorials/grupos'
import type { InstalacaoCopy } from './pt/tutorials/instalacao'
import type { RobosCopy } from './pt/tutorials/robos'
import type { ThinkbotCopy } from './pt/tutorials/thinkbot'

export {
  DEFAULT_LP_LOCALES as LP_LOCALES,
  resolveLpLocale,
  tutorialTracks,
  type BitrixMenuId,
  type DefaultLpLocale as LpLocale,
  type TutorialStep,
  type TutorialTrack,
  type TutorialVariant,
} from '../../../_shared/content'

export type FeatureIcon =
  | 'channels'
  | 'lines'
  | 'buttons'
  | 'templates'
  | 'automation'
  | 'stats'
  | 'permissions'
  | 'media'

export type Tutorial<Screen extends string = string> = LpTutorial<
  Screen,
  TutorialSlug
>

export const TUTORIAL_SLUGS = [
  'instalacao',
  'ativacao',
  'thinkbot',
  'api-oficial',
  'robos',
  'grupos',
] as const
export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number]

export type InstalacaoScreen = 'market' | 'market-app' | 'install'

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

// Mesma ordem de `THINKZAP_ASIDE_CONFIG`.
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

export type LpContent = LpBaseContent<FeatureIcon, DefaultLpLocale> & {
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
    robot: { before: string; stage: string }
  }
  frame: LpFrameCopy & {
    appMenu: Record<AppMenuId, string>
    poweredBy: string
    beta: string
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
}
