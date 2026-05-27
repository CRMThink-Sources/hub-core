import {
  formatAudioTime,
  sanitizeAudioDuration,
} from '@/app/bitrix/widget/audio/_lib/format-audio-time'
import { formatFileSize } from '@/app/bitrix/widget/audio/_lib/format-file-size'

type AudioPreviewPanelProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  audioUrl: string
  isPlaying: boolean
  isSending: boolean
  duration: number
  currentTime: number
  fallbackDurationSeconds?: number
  blobSize?: number
  onLoadedMetadata: (duration: number) => void
  onTimeUpdate: (time: number) => void
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
  onTogglePlayback: () => void
  onSeek: (value: number) => void
  onDelete: () => void
  onSend: () => void
  sendLabel?: string
}

export function AudioPreviewPanel({
  audioRef,
  audioUrl,
  isPlaying,
  isSending,
  duration,
  currentTime,
  fallbackDurationSeconds = 0,
  blobSize,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  onTogglePlayback,
  onSeek,
  onDelete,
  onSend,
  sendLabel = 'Enviar',
}: AudioPreviewPanelProps) {
  const sanitizedDuration = sanitizeAudioDuration(duration)
  const effectiveDuration =
    sanitizedDuration > 0
      ? sanitizedDuration
      : sanitizeAudioDuration(fallbackDurationSeconds)
  const sliderMax = effectiveDuration > 0 ? effectiveDuration : 0
  const sliderValue = Math.min(currentTime, sliderMax || currentTime)

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-700">Preview do audio</p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {effectiveDuration > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {formatAudioTime(effectiveDuration)}
            </span>
          ) : null}
          {blobSize != null && blobSize > 0 ? (
            <span>{formatFileSize(blobSize)}</span>
          ) : null}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        className="hidden"
        onLoadedMetadata={event =>
          onLoadedMetadata(event.currentTarget.duration)
        }
        onTimeUpdate={event => onTimeUpdate(event.currentTarget.currentTime)}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          {isPlaying ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
              aria-hidden="true"
            >
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
              aria-hidden="true"
            >
              <path d="M8 5.5a1 1 0 0 1 1.52-.85l9 5.5a1 1 0 0 1 0 1.7l-9 5.5A1 1 0 0 1 8 16.5v-11Z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={0.01}
            value={sliderValue}
            onChange={event => onSeek(Number(event.target.value))}
            aria-label="Posicao do audio"
            aria-valuemin={0}
            aria-valuemax={sliderMax}
            aria-valuenow={sliderValue}
            disabled={sliderMax <= 0}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-slate-500">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(effectiveDuration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          Excluir
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={isSending}
          className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSending ? 'Enviando...' : sendLabel}
        </button>
      </div>
    </div>
  )
}
