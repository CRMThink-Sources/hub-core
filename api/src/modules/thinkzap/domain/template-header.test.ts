import { describe, expect, it } from 'vitest'
import {
  headerImageExampleOf,
  isMetaCdnUrl,
  templateHeaderOf,
  validateTemplateHeader,
} from './template-header'

const body = { type: 'BODY' as const, text: 'Oi' }
const imageHeader = (imageUrl?: string) => ({
  type: 'HEADER' as const,
  format: 'IMAGE',
  ...(imageUrl === undefined ? {} : { example: { imageUrl } }),
})

describe('templateHeaderOf', () => {
  it('sem HEADER é NONE', () => {
    expect(templateHeaderOf([body])).toBe('NONE')
  })

  it('texto fixo é TEXT', () => {
    expect(
      templateHeaderOf([
        { type: 'HEADER', format: 'TEXT', text: 'Promoção' },
        body,
      ]),
    ).toBe('TEXT')
  })

  it('imagem é IMAGE, inclusive com header_handle da Meta', () => {
    expect(
      templateHeaderOf([
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: ['https://scontent.whatsapp.net/x.jpg'] },
        },
        body,
      ]),
    ).toBe('IMAGE')
  })

  it('texto com variável é UNSUPPORTED', () => {
    expect(
      templateHeaderOf([
        { type: 'HEADER', format: 'TEXT', text: 'Olá {{1}}' },
        body,
      ]),
    ).toBe('UNSUPPORTED')
  })

  it.each(['VIDEO', 'DOCUMENT', 'LOCATION'])('%s é UNSUPPORTED', format => {
    expect(templateHeaderOf([{ type: 'HEADER', format }, body])).toBe(
      'UNSUPPORTED',
    )
  })
})

describe('validateTemplateHeader', () => {
  const codes = (
    components: Parameters<typeof validateTemplateHeader>[0],
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' = 'MARKETING',
  ) => validateTemplateHeader(components, category).map(v => v.code)

  it('sem cabeçalho é válido', () => {
    expect(codes([body])).toEqual([])
  })

  it('imagem https é válida', () => {
    expect(codes([imageHeader('https://loja.com/banner.png'), body])).toEqual(
      [],
    )
  })

  it('header_not_allowed em Autenticação', () => {
    expect(
      codes([imageHeader('https://loja.com/a.png'), body], 'AUTHENTICATION'),
    ).toEqual(['header_not_allowed'])
  })

  it('too_many_headers', () => {
    const header = imageHeader('https://loja.com/a.png')
    expect(codes([header, header, body])).toEqual(['too_many_headers'])
  })

  it('unsupported_format para vídeo e texto', () => {
    expect(codes([{ type: 'HEADER', format: 'VIDEO' }, body])).toEqual([
      'unsupported_format',
    ])
    expect(
      codes([{ type: 'HEADER', format: 'TEXT', text: 'Oi' }, body]),
    ).toEqual(['unsupported_format'])
  })

  it('example_required sem exemplo ou vazio', () => {
    expect(codes([imageHeader(), body])).toEqual(['example_required'])
    expect(codes([imageHeader('  '), body])).toEqual(['example_required'])
  })

  it('example_not_https', () => {
    expect(codes([imageHeader('http://loja.com/a.png'), body])).toEqual([
      'example_not_https',
    ])
    expect(codes([imageHeader('loja.com/a.png'), body])).toEqual([
      'example_not_https',
    ])
  })

  it('example_meta_cdn', () => {
    expect(
      codes([imageHeader('https://scontent.whatsapp.net/v/t61/abc.jpg'), body]),
    ).toEqual(['example_meta_cdn'])
  })
})

describe('isMetaCdnUrl', () => {
  it('casa domínio e subdomínio, não sufixo solto', () => {
    expect(isMetaCdnUrl('https://fbcdn.net/a.jpg')).toBe(true)
    expect(isMetaCdnUrl('https://lookaside.fbsbx.com/a.jpg')).toBe(true)
    expect(isMetaCdnUrl('https://notfbcdn.net/a.jpg')).toBe(false)
  })
})

describe('headerImageExampleOf', () => {
  it('lê a URL de exemplo do cabeçalho de imagem', () => {
    expect(
      headerImageExampleOf([imageHeader(' https://loja.com/a.png '), body]),
    ).toBe('https://loja.com/a.png')
    expect(headerImageExampleOf([body])).toBeUndefined()
  })
})
