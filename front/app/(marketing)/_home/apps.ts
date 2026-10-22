import {
  Bot,
  ChartColumnIncreasing,
  FileSpreadsheet,
  MessageCircle,
  Signature,
  type LucideIcon,
} from 'lucide-react'

export const HUB_APP_IDS = [
  'thinkzap',
  'clicksign',
  'importsheet',
  'thinkanalise',
  'gptmaker',
] as const

export type HubAppId = (typeof HUB_APP_IDS)[number]

export type HubApp = {
  id: HubAppId
  name: string
  Icon: LucideIcon
  /** Classe que remapeia `--primary` para a cor do app (ver `globals.css`). */
  themeClass: string
  /** `null` enquanto o app não tem LP própria: o card mostra "em breve". */
  lpBasePath: string | null
}

export const HUB_APPS: Record<HubAppId, HubApp> = {
  thinkzap: {
    id: 'thinkzap',
    name: 'ThinkZap',
    Icon: MessageCircle,
    themeClass: 'theme-thinkzap',
    lpBasePath: '/lp/thinkzap',
  },
  clicksign: {
    id: 'clicksign',
    name: 'Clicksign',
    Icon: Signature,
    themeClass: 'theme-clicksign',
    lpBasePath: '/lp/clicksign',
  },
  importsheet: {
    id: 'importsheet',
    name: 'ImportSheet',
    Icon: FileSpreadsheet,
    themeClass: 'theme-importsheet',
    lpBasePath: '/lp/importsheet',
  },
  thinkanalise: {
    id: 'thinkanalise',
    name: 'ThinkAnalise',
    Icon: ChartColumnIncreasing,
    themeClass: 'theme-thinkanalise',
    lpBasePath: null,
  },
  gptmaker: {
    id: 'gptmaker',
    name: 'GPTThink',
    Icon: Bot,
    themeClass: 'theme-gptmaker-accent',
    lpBasePath: null,
  },
}
