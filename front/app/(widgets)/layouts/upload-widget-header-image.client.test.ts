import { describe, expect, it } from 'vitest'
import { buildWidgetHeaderImageFormData } from './upload-widget-header-image.client'

describe('buildWidgetHeaderImageFormData', () => {
  it('manda o arquivo no campo image, com o nome original', () => {
    const image = new File([new Uint8Array([0x89, 0x50])], 'promo.png', {
      type: 'image/png',
    })

    const form = buildWidgetHeaderImageFormData(image)

    const sent = form.get('image') as File
    expect(sent.name).toBe('promo.png')
    expect(sent.size).toBe(2)
    expect([...form.keys()]).toEqual(['image'])
  })
})
