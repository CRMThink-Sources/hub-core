import { describe, expect, it } from 'vitest'
import {
  describeAttachmentText,
  resolveOpenChannelText,
} from './describe-attachment-text'

describe('describeAttachmentText', () => {
  it.each([
    ['image', '[Imagem enviada]'],
    ['video', '[Vídeo enviado]'],
    ['audio', '[Áudio enviado]'],
    ['file', '[Arquivo enviado]'],
  ] as const)('descreve %s', (kind, expected) => {
    expect(describeAttachmentText(kind)).toBe(expected)
  })
})

describe('resolveOpenChannelText', () => {
  it('usa o texto do operador quando existe', () => {
    expect(resolveOpenChannelText('Olá', ['image'])).toBe('Olá')
  })

  it('apara o texto do operador', () => {
    expect(resolveOpenChannelText('  Olá  ', [])).toBe('Olá')
  })

  /**
   * O caso que produzia `null` no chat do cliente: envio só de anexo.
   */
  it('cai no descritivo do primeiro anexo quando não há texto', () => {
    expect(resolveOpenChannelText(undefined, ['audio', 'file'])).toBe(
      '[Áudio enviado]',
    )
  })

  it('trata texto em branco como ausente', () => {
    expect(resolveOpenChannelText('   ', ['video'])).toBe('[Vídeo enviado]')
  })

  it('devolve null quando não há texto nem anexo', () => {
    expect(resolveOpenChannelText(undefined, [])).toBeNull()
  })
})
