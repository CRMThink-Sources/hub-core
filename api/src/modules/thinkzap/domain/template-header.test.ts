import { describe, expect, it } from 'vitest'
import {
  headerImageExampleOf,
  isMetaCdnUrl,
  sniffTemplateImageType,
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

describe('validateTemplateHeader com arquivo', () => {
  const withFile = (components: Parameters<typeof validateTemplateHeader>[0]) =>
    validateTemplateHeader(components, 'MARKETING', { hasFile: true }).map(
      v => v.code,
    )

  it('cabeçalho de imagem sem imageUrl é válido com arquivo', () => {
    expect(withFile([{ type: 'HEADER', format: 'IMAGE' }, body])).toEqual([])
  })

  it('example_conflict com arquivo e URL ao mesmo tempo', () => {
    expect(withFile([imageHeader('https://loja.com/a.png'), body])).toEqual([
      'example_conflict',
    ])
  })

  it('file_without_header com arquivo e sem cabeçalho', () => {
    expect(withFile([body])).toEqual(['file_without_header'])
  })

  it('Autenticação continua recusada', () => {
    expect(
      validateTemplateHeader(
        [{ type: 'HEADER', format: 'IMAGE' }, body],
        'AUTHENTICATION',
        { hasFile: true },
      ).map(v => v.code),
    ).toEqual(['header_not_allowed'])
  })
})

describe('sniffTemplateImageType', () => {
  it('reconhece JPEG e PNG pela assinatura', () => {
    expect(sniffTemplateImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    )
    expect(
      sniffTemplateImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe('image/png')
  })

  it('PDF renomeado não passa', () => {
    expect(sniffTemplateImageType(Buffer.from('%PDF-1.7'))).toBeNull()
    expect(sniffTemplateImageType(Buffer.alloc(0))).toBeNull()
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
