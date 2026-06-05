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

export type ImportConfigMapping = {
  columnIndex: number
  columnLabel: string
  fieldName: string
  isIdentifier: boolean
}

export type ImportConfig = {
  source: ImportConfigSource
  target: ImportConfigTarget
  responsible: ImportConfigResponsible | null
  options: { createContact: boolean; createCompany: boolean }
  mappings: ImportConfigMapping[]
}

export type ImportSheetImport = {
  id: number
  appId: string
  title: string
  config: ImportConfig
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
