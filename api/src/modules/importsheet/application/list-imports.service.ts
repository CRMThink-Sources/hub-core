import type { EntityCode, ImportScheduleMode } from '../domain/entities/import'
import type { ImportSheetImportRepository } from '../domain/repositories/importsheet-import.repository'

/** Resumo de uma importação pra listagem — sem o `config` completo. */
export type ImportListItem = {
  id: number
  title: string
  spreadsheetName: string
  entityCode: EntityCode
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: Date | null
  enabled: boolean
  lastRunAt: Date | null
  lastRunStatus: string | null
}

export class ListImportsService {
  constructor(private readonly repository: ImportSheetImportRepository) {}

  async execute(appId: string): Promise<ImportListItem[]> {
    const imports = await this.repository.list(appId)
    return imports.map(i => ({
      id: i.id,
      title: i.title,
      spreadsheetName: i.config.source.spreadsheetName,
      entityCode: i.config.target.entityCode,
      scheduleMode: i.scheduleMode,
      everyHours: i.everyHours,
      weekdays: i.weekdays,
      nextRunAt: i.nextRunAt,
      enabled: i.enabled,
      lastRunAt: i.lastRunAt,
      lastRunStatus: i.lastRunStatus,
    }))
  }
}
