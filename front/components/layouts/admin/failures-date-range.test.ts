import { describe, expect, it } from 'vitest'
import { dayBoundary, earliestDay } from './failures-date-range'

describe('dayBoundary', () => {
  it('sem data não manda nada (a API usa o prazo de guarda)', () => {
    expect(dayBoundary('', 'start')).toBeUndefined()
    expect(dayBoundary('', 'end')).toBeUndefined()
  })

  it('início e fim do dia local escolhido', () => {
    const start = new Date(dayBoundary('2026-11-10', 'start')!)
    const end = new Date(dayBoundary('2026-11-10', 'end')!)

    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2026, 10, 10,
    ])
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0])
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([
      23, 59, 59,
    ])
  })
})

describe('earliestDay', () => {
  it('é o dia de `days` dias atrás, no formato do input de data', () => {
    expect(earliestDay(7, new Date(2026, 10, 13, 15, 0))).toBe('2026-11-06')
  })

  it('atravessa o mês e preenche com zero', () => {
    expect(earliestDay(7, new Date(2026, 10, 3, 9, 0))).toBe('2026-10-27')
    expect(earliestDay(1, new Date(2026, 0, 5, 9, 0))).toBe('2026-01-04')
  })

  it('atravessa o ano', () => {
    expect(earliestDay(7, new Date(2026, 0, 3, 9, 0))).toBe('2025-12-27')
  })
})
