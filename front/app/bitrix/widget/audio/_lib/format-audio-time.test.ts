import { describe, expect, it } from 'vitest'
import {
  computeRecordingDurationSeconds,
  formatAudioTime,
  sanitizeAudioDuration,
} from './format-audio-time'

describe('format-audio-time', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatAudioTime(0)).toBe('00:00')
    expect(formatAudioTime(65)).toBe('01:05')
    expect(formatAudioTime(125)).toBe('02:05')
  })

  it('returns 00:00 for invalid values', () => {
    expect(formatAudioTime(Number.NaN)).toBe('00:00')
    expect(formatAudioTime(Number.POSITIVE_INFINITY)).toBe('00:00')
    expect(formatAudioTime(-1)).toBe('00:00')
  })

  it('sanitizes duration', () => {
    expect(sanitizeAudioDuration(12.4)).toBe(12.4)
    expect(sanitizeAudioDuration(0)).toBe(0)
    expect(sanitizeAudioDuration(Number.POSITIVE_INFINITY)).toBe(0)
    expect(sanitizeAudioDuration(Number.NaN)).toBe(0)
  })

  it('computes recording duration with minimum of 1 second', () => {
    expect(computeRecordingDurationSeconds(1000, 1500)).toBe(1)
    expect(computeRecordingDurationSeconds(0, 5500)).toBe(6)
  })
})
