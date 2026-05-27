import { describe, expect, it, vi } from 'vitest'
import {
  convertRecordedAudioToMp3,
  toMp3FileName,
} from './convert-recorded-audio-to-mp3'

vi.mock('@/shared/helpers/convert-to-mp3', () => ({
  convertToMp3: vi.fn(async (buf: Buffer) => Buffer.from(`mp3:${buf.toString()}`)),
}))

describe('toMp3FileName', () => {
  it('replaces extension with .mp3', () => {
    expect(toMp3FileName('audio-123.webm')).toBe('audio-123.mp3')
  })

  it('adds .mp3 when no extension', () => {
    expect(toMp3FileName('audio-123')).toBe('audio-123.mp3')
  })
})

describe('convertRecordedAudioToMp3', () => {
  it('returns converted buffer and mp3 file name', async () => {
    const result = await convertRecordedAudioToMp3(
      Buffer.from('webm-bytes'),
      'audio-999.webm',
    )

    expect(result.fileName).toBe('audio-999.mp3')
    expect(result.buffer.toString()).toBe('mp3:webm-bytes')
  })
})
