import { describe, expect, it } from 'vitest'
import { InvalidProductUpdateContentError } from '../errors/product-update.errors'
import {
  emptyProductUpdateContent,
  missingLocales,
  parseProductUpdateContent,
  parseProductUpdateTexts,
  sameProductUpdateContent,
} from './product-update-content'

const complete = () =>
  parseProductUpdateContent({
    pt: { title: 'Título', description: 'Descrição' },
    en: { title: 'Title', description: 'Description' },
    es: { title: 'Título', description: 'Descripción' },
    imageKey: 'product-updates/a.png',
  })

describe('parseProductUpdateTexts', () => {
  it('rascunho só com o título em português: o resto vira vazio', () => {
    expect(parseProductUpdateTexts({ pt: { title: 'Novo' } })).toEqual({
      pt: { title: 'Novo', description: '' },
      en: { title: '', description: '' },
      es: { title: '', description: '' },
    })
  })

  it('ausente vira os três idiomas vazios', () => {
    expect(parseProductUpdateTexts(undefined)).toEqual({
      pt: { title: '', description: '' },
      en: { title: '', description: '' },
      es: { title: '', description: '' },
    })
  })

  it('aplica trim nos textos', () => {
    const texts = parseProductUpdateTexts({
      pt: { title: '  Novo  ', description: '\nTexto ' },
    })
    expect(texts.pt).toEqual({ title: 'Novo', description: 'Texto' })
  })

  it('tipo errado ou texto longo demais: erro com o caminho', () => {
    const error: unknown = (() => {
      try {
        parseProductUpdateTexts({
          pt: { title: 42 },
          en: { title: 'x'.repeat(201) },
        })
      } catch (e) {
        return e
      }
    })()

    expect(error).toBeInstanceOf(InvalidProductUpdateContentError)
    const issues = (error as InvalidProductUpdateContentError).issues
    expect(issues.some(issue => issue.startsWith('pt.title'))).toBe(true)
    expect(issues.some(issue => issue.startsWith('en.title'))).toBe(true)
  })
})

describe('parseProductUpdateContent', () => {
  it('sem imageKey vira null', () => {
    expect(parseProductUpdateContent({}).imageKey).toBeNull()
  })
})

describe('missingLocales', () => {
  it('conteúdo completo não falta nada', () => {
    expect(missingLocales(complete())).toEqual([])
  })

  it('aponta os idiomas sem título ou sem descrição, na ordem pt, en, es', () => {
    const content = complete()
    content.es.description = ''
    content.en.title = '   '

    expect(missingLocales(content)).toEqual(['en', 'es'])
  })

  it('rascunho vazio falta tudo', () => {
    expect(missingLocales(emptyProductUpdateContent())).toEqual([
      'pt',
      'en',
      'es',
    ])
  })
})

describe('sameProductUpdateContent', () => {
  it('espaço extra não conta como alteração', () => {
    const other = complete()
    other.en.title = '  Title '
    other.pt.description = 'Descrição\n'

    expect(sameProductUpdateContent(complete(), other)).toBe(true)
  })

  it('texto diferente conta', () => {
    const other = complete()
    other.en.title = 'Another title'

    expect(sameProductUpdateContent(complete(), other)).toBe(false)
  })

  it('imagem diferente conta', () => {
    const other = complete()
    other.imageKey = null

    expect(sameProductUpdateContent(complete(), other)).toBe(false)
  })
})
