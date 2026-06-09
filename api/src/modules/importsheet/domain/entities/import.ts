export type EntityCode =
  | 'LEAD'
  | 'DEAL'
  | 'CONTACT'
  | 'COMPANY'
  | 'SPA'
  | 'TASK'
  | 'FEED'

export type ImportScheduleMode = 'MANUAL' | 'HOURS' | 'DAYS'

export type ImportConfigSource = {
  spreadsheetId: string
  spreadsheetName: string
  tab: { sheetId: number; title: string }
}

export type ImportConfigTarget = {
  entityCode: EntityCode
  entityTypeId: number | null
  categoryId: number | null
}

export type ImportConfigResponsible = {
  columnIndex: number
  matchBy: 'id' | 'email' | 'phone'
}

/** Entidade-destino do mapeamento de uma coluna. */
export type MappingTarget = 'main' | 'contact' | 'company'

export type ImportConfigMapping = {
  columnIndex: number
  columnLabel: string
  fieldName: string
  isIdentifier: boolean
  /** Para qual entidade esse campo vai. Default 'main'. */
  target: MappingTarget
}

export type ImportConfig = {
  source: ImportConfigSource
  target: ImportConfigTarget
  responsible: ImportConfigResponsible | null
  options: { createContact: boolean; createCompany: boolean }
  mappings: ImportConfigMapping[]
  excludedColumns: number[]
}

export type ImportSheetImport = {
  id: number
  appId: string
  title: string
  config: ImportConfig
  startRow: number
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: Date | null
  enabled: boolean
  lastRunAt: Date | null
  lastRunStatus: string | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
