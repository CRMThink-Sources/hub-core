import { describe, expect, it } from 'vitest'
import { classifyRobotFile } from './classify-robot-file'

describe('classifyRobotFile', () => {
  // Tabela do spec: cada extensão de mídia, pelo nome e pelo mime que ela gera.
  it.each([
    ['jpg', 'image', 'image/jpeg'],
    ['jpeg', 'image', 'image/jpeg'],
    ['png', 'image', 'image/png'],
    ['webp', 'image', 'image/webp'],
    ['mp4', 'video', 'video/mp4'],
    ['3gp', 'video', 'video/3gpp'],
    ['mp3', 'audio', 'audio/mpeg'],
    ['ogg', 'audio', 'audio/ogg'],
    ['oga', 'audio', 'audio/ogg'],
    ['opus', 'audio', 'audio/opus'],
    ['wav', 'audio', 'audio/wav'],
    ['m4a', 'audio', 'audio/mp4'],
    ['aac', 'audio', 'audio/aac'],
  ])('.%s → %s', (extension, kind, mime) => {
    expect(classifyRobotFile({ name: `arquivo.${extension}` })).toEqual({
      kind,
      mime,
    })
    expect(classifyRobotFile({ name: 'sem-extensao', mime }).kind).toBe(kind)
  })

  it('classifies by extension when there is no mime', () => {
    expect(classifyRobotFile({ name: 'fachada.png' })).toEqual({
      kind: 'image',
      mime: 'image/png',
    })
    expect(classifyRobotFile({ name: 'video.MP4' })).toEqual({
      kind: 'video',
      mime: 'video/mp4',
    })
    expect(classifyRobotFile({ name: 'recado.ogg' })).toEqual({
      kind: 'audio',
      mime: 'audio/ogg',
    })
  })

  it('sends pdf and spreadsheets as documents', () => {
    expect(classifyRobotFile({ name: 'proposta.pdf' }).kind).toBe('document')
    expect(classifyRobotFile({ name: 'orcamento.xlsx' }).kind).toBe('document')
  })

  it('sends a file without extension as a generic document', () => {
    expect(classifyRobotFile({ name: 'LEIAME' })).toEqual({
      kind: 'document',
      mime: 'application/octet-stream',
    })
  })

  it('prefers the mime reported by Bitrix over the extension', () => {
    expect(classifyRobotFile({ name: 'foto.bin', mime: 'image/jpeg' })).toEqual(
      { kind: 'image', mime: 'image/jpeg' },
    )
    expect(
      classifyRobotFile({ name: 'foto.png', mime: 'application/pdf' }),
    ).toEqual({ kind: 'document', mime: 'application/pdf' })
  })

  it('falls back to the extension when the mime is generic', () => {
    expect(
      classifyRobotFile({
        name: 'recado.opus',
        mime: 'application/octet-stream',
      }),
    ).toEqual({ kind: 'audio', mime: 'audio/opus' })
  })

  it('ignores mime parameters', () => {
    expect(
      classifyRobotFile({ name: 'x', mime: 'audio/ogg; codecs=opus' }).kind,
    ).toBe('audio')
  })
})
