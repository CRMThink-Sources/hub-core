import { describe, expect, it } from 'vitest'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from './normalize-phone-number'

describe('normalizePhoneNumber', () => {
  it('auto-prepends 55 for 11-digit Brazilian number without prefix', () => {
    expect(normalizePhoneNumber('11999999999')).toBe('5511999999999')
  })

  it('auto-prepends 55 for 10-digit Brazilian number without prefix', () => {
    expect(normalizePhoneNumber('1133334444')).toBe('551133334444')
  })

  it('does not prepend 55 when + prefix present (international)', () => {
    expect(normalizePhoneNumber('+14155551234')).toBe('14155551234')
  })

  it('does not prepend 55 when 00 prefix present (international)', () => {
    expect(normalizePhoneNumber('0014155551234')).toBe('14155551234')
  })

  it('passes through number already containing country code (no prefix)', () => {
    expect(normalizePhoneNumber('5511999999999')).toBe('5511999999999')
  })

  it('strips non-digit characters', () => {
    expect(normalizePhoneNumber('+55 (11) 99999-9999')).toBe('5511999999999')
  })

  it('strips leading zeros for short numbers without international prefix', () => {
    expect(normalizePhoneNumber('011999999999')).toBe('5511999999999')
  })
})

describe('isValidZApiPhoneNumber', () => {
  it('accepts valid Brazilian number', () => {
    expect(isValidZApiPhoneNumber('5511999999999')).toBe(true)
  })

  it('accepts valid US number', () => {
    expect(isValidZApiPhoneNumber('14155551234')).toBe(true)
  })

  it('accepts 8-digit number (minimum)', () => {
    expect(isValidZApiPhoneNumber('12345678')).toBe(true)
  })

  it('accepts 15-digit number (maximum E.164)', () => {
    expect(isValidZApiPhoneNumber('123456789012345')).toBe(true)
  })

  it('rejects number with fewer than 8 digits', () => {
    expect(isValidZApiPhoneNumber('1234567')).toBe(false)
  })

  it('rejects number with more than 15 digits', () => {
    expect(isValidZApiPhoneNumber('1234567890123456')).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(isValidZApiPhoneNumber('+5511999999999')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidZApiPhoneNumber('')).toBe(false)
  })
})
