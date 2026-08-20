import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveBitrixTokenExpiresAt } from './resolve-bitrix-token-expires-at'

describe('resolveBitrixTokenExpiresAt', () => {
  const now = 1_700_000_000_000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats small values as relative TTL in seconds', () => {
    const result = resolveBitrixTokenExpiresAt(3600)
    expect(result.getTime()).toBe(now + 3600 * 1000)
  })

  it('treats unix seconds as absolute expiry', () => {
    const unixSec = 1_735_689_600
    const result = resolveBitrixTokenExpiresAt(unixSec)
    expect(result.getTime()).toBe(unixSec * 1000)
  })

  it('treats unix milliseconds as absolute expiry (BX24 case)', () => {
    const unixMs = 1_735_689_600_000
    const result = resolveBitrixTokenExpiresAt(unixMs)
    expect(result.getTime()).toBe(unixMs)
  })

  it('does not produce year-58429 style dates for ms timestamps', () => {
    const bx24Style = 1_842_034_561_020
    const result = resolveBitrixTokenExpiresAt(bx24Style)
    expect(result.getFullYear()).toBeGreaterThan(2020)
    expect(result.getFullYear()).toBeLessThan(2100)
  })
})
