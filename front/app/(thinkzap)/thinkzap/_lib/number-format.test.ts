import { describe, expect, it } from 'vitest'
import { createNumberFormatter, numberLocaleFor } from './number-format'

describe('numberLocaleFor', () => {
  it('mapeia os idiomas do app', () => {
    expect(numberLocaleFor('pt')).toBe('pt-BR')
    expect(numberLocaleFor('en')).toBe('en-US')
    expect(numberLocaleFor('es')).toBe('es-ES')
  })

  it('aceita variante regional pelo prefixo', () => {
    expect(numberLocaleFor('en-GB')).toBe('en-US')
  })

  it('cai em pt-BR para idioma desconhecido ou ausente', () => {
    expect(numberLocaleFor('fr')).toBe('pt-BR')
    expect(numberLocaleFor(undefined)).toBe('pt-BR')
  })
})

describe('createNumberFormatter', () => {
  it('usa o separador de milhar do idioma', () => {
    expect(createNumberFormatter('pt').format(12345)).toBe('12.345')
    expect(createNumberFormatter('en').format(12345)).toBe('12,345')
  })
})
