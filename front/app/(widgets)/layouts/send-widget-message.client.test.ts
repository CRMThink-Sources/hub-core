import { describe, expect, it } from 'vitest'
import { buildSendWidgetFormData } from './send-widget-message.client'

describe('buildSendWidgetFormData', () => {
  it('builds multipart fields for widget message send', () => {
    const audioFile = new File([new Uint8Array([1, 2, 3])], 'audio.webm', {
      type: 'audio/webm',
    })

    const formData = buildSendWidgetFormData({
      subscriptionItemId: 'i1',
      destination: '5511999999999',
      message: 'Ola',
      entity: 'deal',
      entityId: '42',
      attachments: [
        {
          kind: 'audio',
          name: 'audio.webm',
          file: audioFile,
        },
      ],
    })

    expect(formData.get('subscriptionItemId')).toBe('i1')
    expect(formData.get('destination')).toBe('5511999999999')
    expect(formData.get('message')).toBe('Ola')
    expect(formData.get('entity')).toBe('deal')
    expect(formData.get('entityId')).toBe('42')
    expect(formData.get('attachmentsMeta')).toBe(
      JSON.stringify([{ kind: 'audio', name: 'audio.webm' }]),
    )

    const files = formData.getAll('files')
    expect(files).toHaveLength(1)
    expect(files[0]).toBeInstanceOf(File)
  })
})
