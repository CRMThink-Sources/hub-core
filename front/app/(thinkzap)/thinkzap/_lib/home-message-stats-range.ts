/** Janela máxima de seleção da home — mesmo limite validado pelo servidor. */
export const HOME_STATS_MAX_RANGE_MONTHS = 6

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Maior `to` aceitável para um `from` dado, sem estourar a janela máxima.
 * Usado tanto para limitar o seletor (`max` do input) quanto para corrigir uma
 * seleção que ficou inválida depois de mudar `from`.
 */
export function maxRangeEnd(from: Date): Date {
  return addMonths(from, HOME_STATS_MAX_RANGE_MONTHS)
}

/** `to` corrigido para caber na janela máxima a partir de `from`. */
export function clampRangeEnd(from: Date, to: Date): Date {
  const max = maxRangeEnd(from)
  return to.getTime() > max.getTime() ? max : to
}

/** `YYYY-MM-DD`, formato que `<input type="date">` lê e escreve. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

/** Período padrão ao abrir a home: do início do mês corrente até hoje. */
export function defaultRange(now: Date = new Date()): {
  from: Date
  to: Date
} {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  return { from, to }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Período imediatamente anterior, com a mesma duração do range dado — base da
 * comparação "vs período anterior" na home. Termina no dia anterior a `from`,
 * então os dois períodos não se sobrepõem.
 */
export function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime()
  const previousTo = new Date(from.getTime() - DAY_MS)
  const previousFrom = new Date(previousTo.getTime() - durationMs)
  return { from: previousFrom, to: previousTo }
}
