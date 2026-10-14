import { describe, expect, it } from 'vitest'
import { getLpContent, lpPath, resolveLpLocale } from '.'

describe('resolveLpLocale', () => {
  it('reconhece inglês e espanhol', () => {
    expect(resolveLpLocale('en')).toBe('en')
    expect(resolveLpLocale('es')).toBe('es')
  })

  it.each([undefined, 'pt', 'fr', '', 'EN', 'ES', ['en'], ['es']])(
    'fica em português com %j',
    raw => {
      expect(resolveLpLocale(raw)).toBe('pt')
    },
  )
})

describe('getLpContent', () => {
  it('devolve o dicionário do idioma', () => {
    expect(getLpContent('pt').locale).toBe('pt')
    expect(getLpContent('en').locale).toBe('en')
    expect(getLpContent('es').locale).toBe('es')
  })

  it('declara o lang e o og:locale de cada idioma', () => {
    expect(getLpContent('pt').htmlLang).toBe('pt-BR')
    expect(getLpContent('pt').metadata.ogLocale).toBe('pt_BR')
    expect(getLpContent('en').htmlLang).toBe('en')
    expect(getLpContent('en').metadata.ogLocale).toBe('en_US')
    expect(getLpContent('es').htmlLang).toBe('es')
    expect(getLpContent('es').metadata.ogLocale).toBe('es_LA')
  })

  it('não fala de preço, teste grátis nem pagamento', () => {
    for (const locale of ['pt', 'en', 'es'] as const) {
      const text = JSON.stringify(getLpContent(locale))
      expect(text).not.toMatch(
        /pre[çc]i?o|gr[áa]tis|gratuit[oa]|trial|pagamento|price|free|payment|\bpago\b/i,
      )
    }
  })
})

describe('lpPath', () => {
  it('usa a URL sem parâmetro para português', () => {
    expect(lpPath('pt')).toBe('/lp/importsheet')
    expect(lpPath('en')).toBe('/lp/importsheet?lang=en')
    expect(lpPath('es')).toBe('/lp/importsheet?lang=es')
  })
})
