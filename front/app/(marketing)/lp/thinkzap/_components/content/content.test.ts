import { describe, expect, it } from 'vitest'
import { getLpContent, lpPath, resolveLpLocale } from '.'

describe('resolveLpLocale', () => {
  it('reconhece inglês', () => {
    expect(resolveLpLocale('en')).toBe('en')
  })

  it.each([undefined, 'pt', 'fr', '', 'EN', ['en']])(
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
  })

  it('declara o lang e o og:locale de cada idioma', () => {
    expect(getLpContent('pt').htmlLang).toBe('pt-BR')
    expect(getLpContent('pt').metadata.ogLocale).toBe('pt_BR')
    expect(getLpContent('en').htmlLang).toBe('en')
    expect(getLpContent('en').metadata.ogLocale).toBe('en_US')
  })
})

describe('lpPath', () => {
  it('usa a URL sem parâmetro para português', () => {
    expect(lpPath('pt')).toBe('/lp/thinkzap')
    expect(lpPath('en')).toBe('/lp/thinkzap?lang=en')
  })
})
