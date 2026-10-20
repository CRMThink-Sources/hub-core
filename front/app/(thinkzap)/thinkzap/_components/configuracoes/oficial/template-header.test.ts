import { describe, expect, it } from 'vitest'
import {
  buildHeaderComponent,
  templateHeaderOf,
  validateTemplateHeader,
} from './template-header'

describe('validateTemplateHeader', () => {
  it('sem cabeçalho é válido', () => {
    expect(validateTemplateHeader('NONE', '', 'AUTHENTICATION')).toBeNull()
  })

  it('exige a imagem de exemplo', () => {
    expect(validateTemplateHeader('IMAGE', '  ', 'MARKETING')).toBe(
      'example_required',
    )
  })

  it('recusa exemplo http://', () => {
    expect(
      validateTemplateHeader('IMAGE', 'http://loja.com/a.png', 'MARKETING'),
    ).toBe('example_not_https')
  })

  it('recusa link do CDN da Meta', () => {
    expect(
      validateTemplateHeader(
        'IMAGE',
        'https://scontent.whatsapp.net/v/t61/abc.jpg',
        'MARKETING',
      ),
    ).toBe('example_meta_cdn')
  })

  it('recusa cabeçalho em Autenticação', () => {
    expect(
      validateTemplateHeader(
        'IMAGE',
        'https://loja.com/a.png',
        'AUTHENTICATION',
      ),
    ).toBe('header_not_allowed')
  })

  it('aceita imagem https em Marketing e Utilidade', () => {
    expect(
      validateTemplateHeader('IMAGE', 'https://loja.com/a.png', 'MARKETING'),
    ).toBeNull()
    expect(
      validateTemplateHeader('IMAGE', 'https://loja.com/a.png', 'UTILITY'),
    ).toBeNull()
  })
})

describe('buildHeaderComponent', () => {
  it('monta o cabeçalho neutro com a URL limpa', () => {
    expect(buildHeaderComponent('IMAGE', ' https://loja.com/a.png ')).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
      example: { imageUrl: 'https://loja.com/a.png' },
    })
  })

  it('sem cabeçalho não monta nada', () => {
    expect(buildHeaderComponent('NONE', 'https://loja.com/a.png')).toBeNull()
  })
})

describe('templateHeaderOf', () => {
  it('identifica imagem em template sincronizado', () => {
    expect(
      templateHeaderOf([
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: ['x'] },
        },
        { type: 'BODY', text: 'Oi' },
      ]),
    ).toBe('IMAGE')
  })

  it('sem HEADER é NONE; vídeo é UNSUPPORTED', () => {
    expect(templateHeaderOf([{ type: 'BODY', text: 'Oi' }])).toBe('NONE')
    expect(templateHeaderOf([{ type: 'HEADER', format: 'VIDEO' }])).toBe(
      'UNSUPPORTED',
    )
  })
})
