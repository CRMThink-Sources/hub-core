import type {
  ImportConfig,
  ImportScheduleMode,
  ImportSheetImport,
} from '../entities/import'

export type CreateImportSheetImportParams = {
  appId: string
  title: string
  config: ImportConfig
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: Date | null
}

export interface ImportSheetImportRepository {
  create(params: CreateImportSheetImportParams): Promise<ImportSheetImport>
  list(appId: string): Promise<ImportSheetImport[]>
}
