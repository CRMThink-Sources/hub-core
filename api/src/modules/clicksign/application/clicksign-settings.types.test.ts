import { describe, expect, it } from 'vitest'
import { pickCode } from './clicksign-settings.types'

describe('pickCode', () => {
  it('devolve a string achatada como está', () => {
    expect(pickCode('UF_CRM_X')).toBe('UF_CRM_X')
  })

  it('extrai `.code` do formato antigo `{ code }`', () => {
    expect(pickCode({ code: 'UF_CRM_X' })).toBe('UF_CRM_X')
  })

  it('devolve null para nulo/undefined', () => {
    expect(pickCode(null)).toBeNull()
    expect(pickCode(undefined)).toBeNull()
  })

  it('devolve null quando `code` não é string', () => {
    expect(pickCode({ code: 123 })).toBeNull()
    expect(pickCode({})).toBeNull()
  })
})
