import type { ImportConfig, ImportSheetImport } from '../domain/entities/import'
import type { ImportSheetImportRepository } from '../domain/repositories/importsheet-import.repository'
import { resolveSchedule, type CreateImportSchedule } from './schedule'

export type UpdateImportServiceInput = {
  id: number
  appId: string
  title: string
  config: ImportConfig
  startRow: number
  schedule: CreateImportSchedule
}

export class UpdateImportService {
  constructor(private readonly repository: ImportSheetImportRepository) {}

  execute(input: UpdateImportServiceInput): Promise<ImportSheetImport | null> {
    return this.repository.update(input.id, input.appId, {
      title: input.title,
      config: input.config,
      startRow: input.startRow,
      ...resolveSchedule(input.schedule, { immediate: true }),
    })
  }
}
