import {
  resolveLpLocale as resolveSharedLpLocale,
  type LpBaseContent,
  type LpFrameCopy,
  type Tutorial as LpTutorial,
} from '../../../_shared/content'
import type { AgendamentoCopy } from './pt/tutorials/agendamento'
import type { ErrosCopy } from './pt/tutorials/erros'
import type { GoogleCopy } from './pt/tutorials/google'
import type { InstalacaoCopy } from './pt/tutorials/instalacao'
import type { MapeamentoCopy } from './pt/tutorials/mapeamento'
import type { NovaImportacaoCopy } from './pt/tutorials/nova-importacao'

export {
  tutorialTracks,
  type BitrixMenuId,
  type TutorialStep,
  type TutorialTrack,
  type TutorialVariant,
} from '../../../_shared/content'

export const LP_LOCALES = ['pt', 'en', 'es'] as const
export type LpLocale = (typeof LP_LOCALES)[number]

export function resolveLpLocale(raw: unknown): LpLocale {
  return resolveSharedLpLocale(raw, LP_LOCALES)
}

export type FeatureIcon =
  | 'sheets'
  | 'entities'
  | 'mapping'
  | 'dedup'
  | 'schedule'
  | 'incremental'
  | 'errors'
  | 'notify'

export type Tutorial<Screen extends string = string> = LpTutorial<
  Screen,
  TutorialSlug
>

export const TUTORIAL_SLUGS = [
  'instalacao',
  'google',
  'nova-importacao',
  'mapeamento',
  'agendamento',
  'erros',
] as const
export type TutorialSlug = (typeof TUTORIAL_SLUGS)[number]

export type InstalacaoScreen = 'market' | 'market-app' | 'install'

export type GoogleScreen = 'settings' | 'consent' | 'connected'

export type NovaImportacaoScreen = 'empty' | 'paste' | 'tabs' | 'selected'

export type MapeamentoScreen =
  | 'identity'
  | 'entity'
  | 'responsible'
  | 'options'
  | 'mapping'
  | 'identifier'
  | 'save'

export type AgendamentoScreen =
  | 'frequency'
  | 'hours'
  | 'scheduled'
  | 'manual-run'
  | 'queued'

export type ErrosScreen = 'list' | 'errors' | 'notify' | 'save'

// Mesma ordem de `IMPORTSHEET_ASIDE_CONFIG`.
export const APP_MENU_IDS = [
  'importacoes',
  'configuracoes',
  'logs',
  'ajuda',
] as const
export type AppMenuId = (typeof APP_MENU_IDS)[number]

// Mesma ordem de `ENTITIES` em `configurar-importacao/constants.ts`.
export const ENTITY_IDS = [
  'LEAD',
  'DEAL',
  'CONTACT',
  'COMPANY',
  'SPA',
  'TASK',
  'FEED',
] as const
export type EntityId = (typeof ENTITY_IDS)[number]

export type MatchBy = 'id' | 'email' | 'phone'
export type MappingTarget = 'main' | 'contact' | 'company'
export type FieldType = 'lista' | 'data' | 'sn' | 'moeda' | 'contato'

export type SampleColumn = {
  letter: string
  label: string
  target: MappingTarget
  field: string
  type?: FieldType
}

export type LpContent = LpBaseContent<FeatureIcon, LpLocale> & {
  hero: { eyebrow: string; title: string; subtitle: string }
  sheetPreview: {
    columns: [string, string, string]
    rows: [string, string, string][]
    entity: string
    created: string
    updated: string
  }
  frame: LpFrameCopy & {
    appMenu: Record<AppMenuId, string>
    poweredBy: string
    beta: string
  }
  shared: {
    importacoes: {
      title: string
      subtitle: string
      newImport: string
      emptyBefore: string
      emptyAfter: string
    }
    lista: {
      manual: string
      everyHours: (hours: number) => string
      run: string
      running: string
      scheduleActive: string
      schedulePaused: string
      pauseSchedule: string
      edit: string
      lastRun: (when: string) => string
      neverRun: string
      viewErrors: string
    }
    configuracoes: {
      title: string
      subtitle: string
      googleConnection: string
      connected: string
      noAccount: string
      connectGoogle: string
      disconnect: string
      success: string
      closeNotice: string
      notifyTitle: string
      notifyDescription: string
      selectedCount: (count: number) => string
      recipients: string
      clearAll: string
      noneSelected: string
      searchUser: string
      unsaved: string
      allSaved: string
      save: string
    }
    configure: {
      title: string
      description: string
      back: string
      cancel: string
      save: string
      identity: {
        name: string
        spreadsheet: string
        tab: string
        startRow: string
        startRowHint: string
      }
      destination: { entity: string; pipeline: string }
      entities: Record<EntityId, string>
      responsible: { column: string; matchBy: string }
      match: Record<MatchBy, string>
      options: { createContact: string; createCompany: string }
      schedule: {
        title: string
        frequency: string
        everyHours: string
        weekdays: string
        manual: string
        frequencyOptions: { hours: string; days: string }
        /** Domingo a sábado, como `WEEKDAYS` do app. */
        weekdayLabels: string[]
      }
      mapping: {
        title: string
        description: string
        counter: (mapped: number, total: number) => string
        column: string
        destination: string
        field: string
        identifier: string
        actions: string
        useAsIdentifier: string
        removeColumn: string
        destinations: Record<Exclude<MappingTarget, 'main'>, string>
        fieldTypes: Record<FieldType, string>
      }
    }
    sample: {
      importTitle: string
      spreadsheetName: string
      spreadsheetId: string
      tab: string
      pipeline: string
      columns: SampleColumn[]
      googleEmail: string
      lastRunWhen: string
      manualImportTitle: string
      manualSpreadsheetName: string
    }
  }
  tutorials: {
    instalacao: InstalacaoCopy
    google: GoogleCopy
    'nova-importacao': NovaImportacaoCopy
    mapeamento: MapeamentoCopy
    agendamento: AgendamentoCopy
    erros: ErrosCopy
  }
}
