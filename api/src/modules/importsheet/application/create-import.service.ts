import type { ImportConfig, ImportSheetImport, ImportScheduleMode } from '../domain/entities/import'
import type { ImportSheetImportRepository } from '../domain/repositories/importsheet-import.repository'

export type CreateImportSchedule =
  | { mode: 'manual' }
  | { mode: 'hours'; everyHours: number }
  | { mode: 'days'; weekdays: number[] }

export type CreateImportServiceInput = {
  appId: string
  title: string
  config: ImportConfig
  schedule: CreateImportSchedule
}

export class CreateImportService {
  constructor(private readonly repository: ImportSheetImportRepository) {}

  async execute(input: CreateImportServiceInput): Promise<ImportSheetImport> {
    const { scheduleMode, everyHours, weekdays, nextRunAt } = this.resolveSchedule(
      input.schedule,
    )

    return this.repository.create({
      appId: input.appId,
      title: input.title,
      config: input.config,
      scheduleMode,
      everyHours,
      weekdays,
      nextRunAt,
    })
  }

  private resolveSchedule(schedule: CreateImportSchedule): {
    scheduleMode: ImportScheduleMode
    everyHours: number | null
    weekdays: number[] | null
    nextRunAt: Date | null
  } {
    if (schedule.mode === 'manual') {
      return { scheduleMode: 'MANUAL', everyHours: null, weekdays: null, nextRunAt: null }
    }

    if (schedule.mode === 'hours') {
      const nextRunAt = new Date(Date.now() + schedule.everyHours * 60 * 60 * 1000)
      return { scheduleMode: 'HOURS', everyHours: schedule.everyHours, weekdays: null, nextRunAt }
    }

    // days: próxima ocorrência de qualquer dia da semana listado
    const nextRunAt = this.nextWeekdayRun(schedule.weekdays)
    return { scheduleMode: 'DAYS', everyHours: null, weekdays: schedule.weekdays, nextRunAt }
  }

  // Retorna meia-noite (UTC) do próximo dia que bate com algum dos weekdays.
  private nextWeekdayRun(weekdays: number[]): Date {
    if (weekdays.length === 0) return new Date()
    const now = new Date()
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = new Date(now)
      candidate.setUTCDate(now.getUTCDate() + offset)
      candidate.setUTCHours(0, 0, 0, 0)
      if (weekdays.includes(candidate.getUTCDay())) return candidate
    }
    return new Date()
  }
}
