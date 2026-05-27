export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function sanitizeAudioDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function computeRecordingDurationSeconds(
  startedAt: number,
  endedAt: number,
): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0
  return Math.max(1, Math.ceil((endedAt - startedAt) / 1000))
}
