import { describe, expect, it } from 'vitest'
import {
  buildCreateTemplateFormData,
  buildDefaultImageRequest,
} from './use-connector-templates'

describe('buildCreateTemplateFormData', () => {
  it('manda o JSON em payload e a imagem em headerImage', () => {
    const payload = {
      name: 'promo',
      category: 'MARKETING' as const,
      language: 'pt_BR',
      components: [
        { type: 'HEADER' as const, format: 'IMAGE' },
        { type: 'BODY' as const, text: 'Oferta' },
      ],
    }
    const image = new File([new Uint8Array([0x89, 0x50])], 'banner.png', {
      type: 'image/png',
    })

    const form = buildCreateTemplateFormData(payload, image)

    expect(JSON.parse(form.get('payload') as string)).toEqual(payload)
    const sent = form.get('headerImage') as File
    expect(sent.name).toBe('banner.png')
    expect(sent.size).toBe(2)
  })
})

describe('buildDefaultImageRequest', () => {
  it('link vai em JSON, sem espaços', () => {
    expect(
      buildDefaultImageRequest({ imageUrl: ' https://loja.com/a.png ' }),
    ).toEqual({
      imageUrl: 'https://loja.com/a.png',
    })
  })

  it('arquivo vai em multipart no campo image', () => {
    const file = new File([new Uint8Array([0x89])], 'a.png', {
      type: 'image/png',
    })

    const form = buildDefaultImageRequest({ file }) as FormData

    expect((form.get('image') as File).name).toBe('a.png')
  })
})
