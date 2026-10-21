import { describe, expect, it } from 'vitest'
import { cadenceNotices, formatCadenceTime } from './cadence-notices'

// 13:05:40Z = 10:05 em Brasília.
const RETRY_AT = Date.parse('2026-10-21T13:05:40.000Z')

describe('cadenceNotices', () => {
  it('horário em HH:mm no fuso de São Paulo', () => {
    expect(formatCadenceTime(RETRY_AT)).toBe('10:05')
  })

  it('Aviso de espera da cadência em inglês', () => {
    const text = cadenceNotices('en').operatorWaiting(RETRY_AT)
    expect(text).toContain('waiting')
    expect(text).toContain('10:05')
  })

  it.each(['pt', 'es'] as const)('%s traz o horário previsto', locale => {
    expect(cadenceNotices(locale).operatorWaiting(RETRY_AT)).toContain('10:05')
  })
})
