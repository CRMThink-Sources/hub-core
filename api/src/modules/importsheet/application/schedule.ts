import type { ImportScheduleMode } from '../domain/entities/import'

export type CreateImportSchedule =
  | { mode: 'manual' }
  | { mode: 'hours'; everyHours: number }
  | { mode: 'days'; weekdays: number[] }

export type ResolvedSchedule = {
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: Date | null
}

export function resolveSchedule(
  schedule: CreateImportSchedule,
): ResolvedSchedule {
  if (schedule.mode === 'manual') {
    return {
      scheduleMode: 'MANUAL',
      everyHours: null,
      weekdays: null,
      nextRunAt: null,
    }
  }

  if (schedule.mode === 'hours') {
    const nextRunAt = new Date(
      Date.now() + schedule.everyHours * 60 * 60 * 1000,
    )
    return {
      scheduleMode: 'HOURS',
      everyHours: schedule.everyHours,
      weekdays: null,
      nextRunAt,
    }
  }

  return {
    scheduleMode: 'DAYS',
    everyHours: null,
    weekdays: schedule.weekdays,
    nextRunAt: nextWeekdayRun(schedule.weekdays),
  }
}

// Meia-noite (UTC) do próximo dia que bate com algum dos weekdays.
function nextWeekdayRun(weekdays: number[]): Date {
  const now = new Date()
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now)
    candidate.setUTCDate(now.getUTCDate() + offset)
    candidate.setUTCHours(0, 0, 0, 0)
    if (weekdays.includes(candidate.getUTCDay())) return candidate
  }
  return now
}
