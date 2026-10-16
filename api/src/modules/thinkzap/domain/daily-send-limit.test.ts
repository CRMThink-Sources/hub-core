import { describe, expect, it } from 'vitest'
import { computeDailyLimitUsage, isValidDailyAmount } from './daily-send-limit'

describe('computeDailyLimitUsage', () => {
  it('uso parcial: 225 de 300 dá 25% restantes', () => {
    expect(
      computeDailyLimitUsage({
        enabled: true,
        limit: 300,
        sent: 225,
        extra: 0,
      }),
    ).toEqual({
      enabled: true,
      limit: 300,
      sentToday: 225,
      extraToday: 0,
      effectiveLimit: 300,
      remainingPercent: 25,
      reached: false,
    })
  })

  it('limite atingido: 300 de 300 dá 0% e reached', () => {
    const usage = computeDailyLimitUsage({
      enabled: true,
      limit: 300,
      sent: 300,
      extra: 0,
    })

    expect(usage.remainingPercent).toBe(0)
    expect(usage.reached).toBe(true)
  })

  it('extras somam ao efetivo: 350 de 300 + 100 dá 13%', () => {
    const usage = computeDailyLimitUsage({
      enabled: true,
      limit: 300,
      sent: 350,
      extra: 100,
    })

    expect(usage.effectiveLimit).toBe(400)
    expect(usage.remainingPercent).toBe(13)
    expect(usage.reached).toBe(false)
  })

  it('acima do efetivo (limite baixado no dia) não fica negativo', () => {
    const usage = computeDailyLimitUsage({
      enabled: true,
      limit: 100,
      sent: 250,
      extra: 0,
    })

    expect(usage.remainingPercent).toBe(0)
    expect(usage.reached).toBe(true)
  })

  it('desligado: mostra enviadas, sem efetivo nem percentual', () => {
    expect(
      computeDailyLimitUsage({
        enabled: false,
        limit: 300,
        sent: 40,
        extra: 0,
      }),
    ).toEqual({
      enabled: false,
      limit: 300,
      sentToday: 40,
      extraToday: 0,
      effectiveLimit: null,
      remainingPercent: null,
      reached: false,
    })
  })
})

describe('isValidDailyAmount', () => {
  it.each([
    [1, true],
    [300, true],
    [0, false],
    [-1, false],
    [1.5, false],
    [null, false],
    ['300', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidDailyAmount(value)).toBe(expected)
  })
})
