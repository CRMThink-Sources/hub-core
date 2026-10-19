import { describe, expect, it } from 'vitest'
import { buildCaptionedParts } from './build-captioned-parts'

const pdf = { kind: 'document' as const, url: 'u1', fileName: 'proposta.pdf' }
const png = { kind: 'image' as const, url: 'u2', fileName: 'anexo.png' }
const ogg = { kind: 'audio' as const, url: 'u3', fileName: 'recado.ogg' }

describe('buildCaptionedParts', () => {
  it('turns the text into the caption of a document', () => {
    expect(buildCaptionedParts('Segue sua proposta', [pdf])).toEqual([
      { ...pdf, text: 'Segue sua proposta' },
    ])
  })

  it('sends the text first when the first file is audio', () => {
    expect(buildCaptionedParts('Ouça o recado', [ogg])).toEqual([
      { kind: 'text', text: 'Ouça o recado' },
      ogg,
    ])
  })

  it('captions only the first file and keeps the order', () => {
    expect(buildCaptionedParts('Documentos', [pdf, png])).toEqual([
      { ...pdf, text: 'Documentos' },
      png,
    ])
  })

  it('sends only the files when there is no text', () => {
    expect(buildCaptionedParts(undefined, [pdf, png])).toEqual([pdf, png])
    expect(buildCaptionedParts('', [pdf])).toEqual([pdf])
  })

  it('sends only the text when there are no files', () => {
    expect(buildCaptionedParts('Olá', [])).toEqual([
      { kind: 'text', text: 'Olá' },
    ])
  })

  it('returns no parts without text and files', () => {
    expect(buildCaptionedParts(undefined, [])).toEqual([])
  })
})
