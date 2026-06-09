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

export type ResolveScheduleOptions = {
  /** Primeira execução imediata (no create/update); o reagendamento usa o intervalo. */
  immediate?: boolean
}

export function resolveSchedule(
  schedule: CreateImportSchedule,
  options: ResolveScheduleOptions = {},
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
    // immediate → roda no próximo tick (≤60s); senão, daqui a `everyHours`.
    const nextRunAt = options.immediate
      ? new Date()
      : new Date(Date.now() + schedule.everyHours * 60 * 60 * 1000)
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
