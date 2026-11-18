import { describe, expect, it } from 'vitest'
import { dashboardPath, todayPath } from './use-insights'

describe('dashboardPath', () => {
  it('manda só os filtros preenchidos', () => {
    expect(
      dashboardPath({ from: '2026-10-20', to: '2026-11-18', dept: '' }),
    ).toBe('/thinkzap/insights/dashboard?from=2026-10-20&to=2026-11-18')
  })

  it('inclui setor, operador e agrupamentos', () => {
    expect(
      dashboardPath({
        from: '2026-11-01',
        to: '2026-11-18',
        dept: '7',
        operator: '12',
        g: 'week',
        sg: 'month',
      }),
    ).toBe(
      '/thinkzap/insights/dashboard?from=2026-11-01&to=2026-11-18&dept=7&operator=12&g=week&sg=month',
    )
  })
})

describe('todayPath', () => {
  it('passa o limite de alerta em minutos', () => {
    expect(todayPath(15)).toBe('/thinkzap/insights/today?alertMin=15')
    expect(todayPath(null)).toBe('/thinkzap/insights/today')
  })
})
