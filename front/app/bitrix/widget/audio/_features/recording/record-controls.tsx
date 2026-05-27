import { formatAudioTime } from '@/app/bitrix/widget/audio/_lib/format-audio-time'

type RecordControlsProps = {
  isRecording: boolean
  buttonScale: number
  elapsedSeconds?: number
  onToggle: () => void
}

export function RecordControls({
  isRecording,
  buttonScale,
  elapsedSeconds = 0,
  onToggle,
}: RecordControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={isRecording ? 'Parar gravacao' : 'Iniciar gravacao'}
        title={isRecording ? 'Parar gravacao' : 'Iniciar gravacao'}
        className={`relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full text-white shadow-md transition focus-visible:ring-4 focus-visible:ring-blue-100 ${
          isRecording
            ? 'bg-rose-600 hover:bg-rose-500'
            : 'bg-slate-900 hover:bg-slate-800'
        }`}
        style={{
          transform: `scale(${buttonScale})`,
        }}
      >
        {isRecording ? (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-40"
            aria-hidden="true"
          />
        ) : null}
        {isRecording ? (
          <svg
            viewBox="0 0 24 24"
            className="relative h-5 w-5 fill-current"
            aria-hidden="true"
          >
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="relative h-5 w-5 fill-current"
            aria-hidden="true"
          >
            <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M18 12a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V22h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 1 1 2 0 6 6 0 1 0 12 0Z" />
          </svg>
        )}
      </button>

      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-600">
          {isRecording ? 'Gravando... toque para parar' : 'Toque para gravar'}
        </p>
        {isRecording ? (
          <p
            className="font-mono text-xs font-semibold text-rose-600 tabular-nums"
            aria-live="polite"
          >
            {formatAudioTime(elapsedSeconds)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
