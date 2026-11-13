/** Início e fim do dia **local** escolhido, em ISO para a API. */
export function dayBoundary(
  day: string,
  edge: 'start' | 'end',
): string | undefined {
  if (!day) return undefined
  const [year, month, date] = day.split('-').map(Number)
  const value =
    edge === 'start'
      ? new Date(year, month - 1, date, 0, 0, 0, 0)
      : new Date(year, month - 1, date, 23, 59, 59, 999)
  return value.toISOString()
}

/**
 * `YYYY-MM-DD` local de `days` dias atrás. O seletor de datas não vai além do prazo de
 * guarda das falhas: pedir mais que isso a API recusa.
 */
export function earliestDay(days: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() - days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
