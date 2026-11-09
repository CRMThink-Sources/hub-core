import { describe, expect, it } from 'vitest'
import {
  filterTemplates,
  normalizeSearchText,
  templateSnippet,
} from './template-search'

const t = (name: string, body = '', language = 'pt_BR') => ({
  name,
  language,
  body,
})

const templates = [
  t('promo_natal', 'Aproveite as ofertas de Natal'),
  t('promo_pascoa', 'Chocolates com desconto'),
  t('boleto_vencido', 'Seu boleto vence amanhã'),
  t('boas_vindas', 'Bem-vindo', 'en_US'),
  t('boas_vindas', 'Bem-vindo'),
]

const names = (list: { name: string; language: string }[]) =>
  list.map(x => `${x.name}|${x.language}`)

describe('normalizeSearchText', () => {
  it('tira acento, caixa e espaços extras', () => {
    expect(normalizeSearchText('  CoBRança   Ágil ')).toBe('cobranca agil')
  })
})

describe('filterTemplates', () => {
  it('busca por nome', () => {
    expect(names(filterTemplates(templates, 'promo'))).toEqual([
      'promo_natal|pt_BR',
      'promo_pascoa|pt_BR',
    ])
  })

  it('busca pelo corpo', () => {
    expect(names(filterTemplates(templates, 'boleto'))).toContain(
      'boleto_vencido|pt_BR',
    )
  })

  it('ignora acento e maiúscula', () => {
    expect(filterTemplates(templates, 'AMANHA')).toHaveLength(1)
    expect(filterTemplates([t('x', 'Cobrança')], 'COBRANCA')).toHaveLength(1)
  })

  it('várias palavras: todas, em qualquer campo', () => {
    expect(names(filterTemplates(templates, 'promo natal'))).toEqual([
      'promo_natal|pt_BR',
    ])
    expect(filterTemplates(templates, 'natal promo')).toHaveLength(1)
    expect(filterTemplates(templates, 'promo boleto')).toHaveLength(0)
  })

  it('busca por idioma', () => {
    expect(names(filterTemplates(templates, 'en_us'))).toEqual([
      'boas_vindas|en_US',
    ])
  })

  it('busca vazia ou só com espaços devolve tudo', () => {
    expect(filterTemplates(templates, '')).toHaveLength(templates.length)
    expect(filterTemplates(templates, '   ')).toHaveLength(templates.length)
  })

  it('sem resultado devolve vazio', () => {
    expect(filterTemplates(templates, 'zzz')).toEqual([])
  })
})

describe('templateSnippet', () => {
  it('colapsa quebras de linha', () => {
    expect(templateSnippet('Olá\n\n{{1}}\n tudo bem')).toBe('Olá {{1}} tudo bem')
  })

  it('trunca com reticências', () => {
    expect(templateSnippet('a'.repeat(100), 10)).toBe(`${'a'.repeat(10)}…`)
  })

  it('corpo vazio devolve vazio', () => {
    expect(templateSnippet('')).toBe('')
  })
})
