import { describe, expect, it } from 'vitest'
import {
  buildHeaderComponent,
  templateHeaderOf,
  validateTemplateHeader,
  validateTemplateHeaderFile,
  validateTemplateHeaderKeep,
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

describe('validateTemplateHeaderFile', () => {
  const png = (size = 300 * 1024) => ({ type: 'image/png', size })

  it('exige o arquivo', () => {
    expect(validateTemplateHeaderFile('IMAGE', null, 'MARKETING')).toBe(
      'file_required',
    )
  })

  it('aceita PNG e JPEG de até 5 MB', () => {
    expect(validateTemplateHeaderFile('IMAGE', png(), 'MARKETING')).toBeNull()
    expect(
      validateTemplateHeaderFile(
        'IMAGE',
        { type: 'image/jpeg', size: 5 * 1024 * 1024 },
        'UTILITY',
      ),
    ).toBeNull()
  })

  it('recusa arquivo de 7 MB', () => {
    expect(
      validateTemplateHeaderFile('IMAGE', png(7 * 1024 * 1024), 'MARKETING'),
    ).toBe('file_too_large')
  })

  it('recusa PDF', () => {
    expect(
      validateTemplateHeaderFile(
        'IMAGE',
        { type: 'application/pdf', size: 1000 },
        'MARKETING',
      ),
    ).toBe('file_invalid_type')
  })

  it('Autenticação e sem cabeçalho', () => {
    expect(validateTemplateHeaderFile('IMAGE', png(), 'AUTHENTICATION')).toBe(
      'header_not_allowed',
    )
    expect(validateTemplateHeaderFile('NONE', null, 'MARKETING')).toBeNull()
  })
})

describe('validateTemplateHeaderKeep', () => {
  it('manter a imagem exige imagem padrão do envio', () => {
    expect(validateTemplateHeaderKeep('IMAGE', false, 'MARKETING')).toBe(
      'default_required',
    )
    expect(validateTemplateHeaderKeep('IMAGE', true, 'MARKETING')).toBeNull()
    expect(validateTemplateHeaderKeep('NONE', false, 'MARKETING')).toBeNull()
  })

  it('manter a imagem monta o cabeçalho sem example', () => {
    expect(buildHeaderComponent('IMAGE', 'KEEP', 'https://x/a.png')).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
    })
  })
})

describe('buildHeaderComponent', () => {
  it('com link, monta o cabeçalho neutro com a URL limpa', () => {
    expect(
      buildHeaderComponent('IMAGE', 'LINK', ' https://loja.com/a.png '),
    ).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
      example: { imageUrl: 'https://loja.com/a.png' },
    })
  })

  it('com arquivo, monta o cabeçalho sem example', () => {
    expect(buildHeaderComponent('IMAGE', 'FILE', '')).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
    })
  })

  it('sem cabeçalho não monta nada', () => {
    expect(
      buildHeaderComponent('NONE', 'LINK', 'https://loja.com/a.png'),
    ).toBeNull()
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
