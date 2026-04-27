type AudioPreviewProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  audioUrl: string
  isPlaying: boolean
  isSending: boolean
  duration: number
  currentTime: number
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

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function AudioPreview({
  audioRef,
  audioUrl,
  isPlaying,
  isSending,
  duration,
  currentTime,
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
}: AudioPreviewProps) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-medium text-slate-700">
        Preview do audio
      </p>
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
          className="cursor-pointer grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800"
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

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={event => onSeek(Number(event.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Excluir
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={isSending}
          className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSending ? 'Enviando...' : sendLabel}
        </button>
      </div>
    </div>
  )
}
