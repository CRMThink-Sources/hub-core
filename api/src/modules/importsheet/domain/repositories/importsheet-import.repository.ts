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

export type UpdateImportSheetImportParams = Omit<
  CreateImportSheetImportParams,
  'appId'
>

export interface ImportSheetImportRepository {
  create(params: CreateImportSheetImportParams): Promise<ImportSheetImport>
  list(appId: string): Promise<ImportSheetImport[]>
  findById(id: number, appId: string): Promise<ImportSheetImport | null>
  update(
    id: number,
    appId: string,
    params: UpdateImportSheetImportParams,
  ): Promise<ImportSheetImport | null>
  delete(id: number, appId: string): Promise<boolean>
}
