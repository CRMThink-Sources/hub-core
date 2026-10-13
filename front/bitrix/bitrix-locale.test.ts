import { describe, expect, it } from 'vitest'
import { localeFromBitrixLang } from './bitrix-locale'

describe('localeFromBitrixLang', () => {
  it('mapeia os códigos do Bitrix', () => {
    expect(localeFromBitrixLang('br')).toBe('pt')
    expect(localeFromBitrixLang('en')).toBe('en')
    expect(localeFromBitrixLang('la')).toBe('es')
  })

  it('é null para idioma sem tradução ou ausente', () => {
    expect(localeFromBitrixLang('de')).toBeNull()
    expect(localeFromBitrixLang('')).toBeNull()
    expect(localeFromBitrixLang(undefined)).toBeNull()
  })
})
