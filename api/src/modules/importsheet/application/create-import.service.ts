import type { ImportConfig, ImportSheetImport } from '../domain/entities/import'
import type { ImportSheetImportRepository } from '../domain/repositories/importsheet-import.repository'
import { resolveSchedule, type CreateImportSchedule } from './schedule'

export type CreateImportServiceInput = {
  appId: string
  title: string
  config: ImportConfig
  startRow: number
  schedule: CreateImportSchedule
}

export class CreateImportService {
  constructor(private readonly repository: ImportSheetImportRepository) {}

  async execute(input: CreateImportServiceInput): Promise<ImportSheetImport> {
    return this.repository.create({
      appId: input.appId,
      title: input.title,
      config: input.config,
      startRow: input.startRow,
      ...resolveSchedule(input.schedule, { immediate: true }),
    })
  }
}
