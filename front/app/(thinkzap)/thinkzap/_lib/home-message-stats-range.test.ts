import { describe, expect, it } from 'vitest'
import {
  clampRangeEnd,
  defaultRange,
  fromDateInputValue,
  maxRangeEnd,
  toDateInputValue,
} from './home-message-stats-range'

describe('maxRangeEnd', () => {
  it('soma 6 meses ao from', () => {
    const from = new Date('2026-01-15T00:00:00.000Z')
    expect(maxRangeEnd(from).toISOString().slice(0, 10)).toBe('2026-07-15')
  })
})

describe('clampRangeEnd', () => {
  it('mantém to quando está dentro da janela', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const to = new Date('2026-02-01T00:00:00.000Z')
    expect(clampRangeEnd(from, to)).toEqual(to)
  })

  it('corta to no limite de 6 meses quando ultrapassa', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const to = new Date('2026-12-01T00:00:00.000Z')
    expect(clampRangeEnd(from, to)).toEqual(maxRangeEnd(from))
  })
})

describe('toDateInputValue / fromDateInputValue', () => {
  it('faz o round-trip sem perder o dia', () => {
    const date = new Date('2026-03-05T00:00:00.000Z')
    expect(fromDateInputValue(toDateInputValue(date))).toEqual(date)
  })
})

describe('defaultRange', () => {
  it('vai do início do mês até hoje', () => {
    const now = new Date('2026-03-15T12:00:00.000Z')
    const { from, to } = defaultRange(now)
    expect(toDateInputValue(from)).toBe('2026-03-01')
    expect(toDateInputValue(to)).toBe('2026-03-15')
  })
})
