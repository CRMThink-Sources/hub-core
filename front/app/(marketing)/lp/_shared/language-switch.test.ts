import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LP_LOCALES, localizedLpPath, resolveLpLocale } from './content'
import { LanguageSwitch } from './language-switch'

describe('LanguageSwitch', () => {
  const render = (locale: 'pt' | 'en' | 'es', locales?: typeof LP_LOCALES) =>
    renderToStaticMarkup(
      createElement(LanguageSwitch, {
        locale,
        label: 'Idioma',
        basePath: '/lp/app',
        locales,
      }),
    )

  it('marca o idioma atual e linka o outro', () => {
    const html = render('en')
    expect(html).toMatch(/<span[^>]*aria-current="true"[^>]*>EN<\/span>/)
    expect(html).toMatch(/<a[^>]*href="\/lp\/app"[^>]*>PT<\/a>/)
    expect(html).toContain('aria-label="Idioma"')
  })

  it('em português, linka para ?lang=en', () => {
    const html = render('pt')
    expect(html).toMatch(/<span[^>]*aria-current="true"[^>]*>PT<\/span>/)
    expect(html).toMatch(/<a[^>]*href="\/lp\/app\?lang=en"[^>]*>EN<\/a>/)
  })

  it('sem `locales`, mostra só PT e EN', () => {
    expect(render('pt')).not.toContain('ES')
  })

  it('com espanhol, mostra os três na ordem e linka ?lang=es', () => {
    const html = render('pt', LP_LOCALES)
    expect(html.match(/>(PT|EN|ES)</g)).toEqual(['>PT<', '>EN<', '>ES<'])
    expect(html).toMatch(
      /<a[^>]*href="\/lp\/app\?lang=es"[^>]*lang="es"[^>]*>ES<\/a>/,
    )
    const es = render('es', LP_LOCALES)
    expect(es).toMatch(
      /<span[^>]*lang="es"[^>]*aria-current="true"[^>]*>ES<\/span>/,
    )
    expect(es).toMatch(/<a[^>]*href="\/lp\/app"[^>]*>PT<\/a>/)
  })
})

describe('localizedLpPath', () => {
  it('usa a URL sem parâmetro para português', () => {
    expect(localizedLpPath('/lp/app', 'pt')).toBe('/lp/app')
    expect(localizedLpPath('/lp/app', 'en')).toBe('/lp/app?lang=en')
    expect(localizedLpPath('/lp/app', 'es')).toBe('/lp/app?lang=es')
  })
})

describe('resolveLpLocale', () => {
  it('por padrão, só `en` muda o idioma', () => {
    expect(resolveLpLocale('en')).toBe('en')
    expect(resolveLpLocale(['en'])).toBe('pt')
    expect(resolveLpLocale(undefined)).toBe('pt')
  })

  it('espanhol só vale para LP que o declara', () => {
    expect(resolveLpLocale('es')).toBe('pt')
    expect(resolveLpLocale('es', LP_LOCALES)).toBe('es')
    expect(resolveLpLocale('en', LP_LOCALES)).toBe('en')
    expect(resolveLpLocale(['es'], LP_LOCALES)).toBe('pt')
    expect(resolveLpLocale('fr', LP_LOCALES)).toBe('pt')
  })
})
