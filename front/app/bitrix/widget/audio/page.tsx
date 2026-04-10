'use client'
import { BX24Script } from '@/bitrix'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { envConfig } from '@/shared/infra/env-config'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { AudioPreview } from './_components/audio-preview'
import { RecordToggleButton } from './_components/record-toggle-button'
import { useAudioWidget } from './_hooks/use-audio-widget'

function BitrixImTextAreaContent() {
  const searchParams = useSearchParams()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const dialogId = searchParams.get('DIALOG_ID')
  const domain = searchParams.get('DOMAIN')
  /** Proxy no Next evita CORS (browser → mesmo origin; servidor → API). */
  const uploadEndpoint = '/api/audio/upload'

  const {
    audioRef,
    isRecording,
    buttonScale,
    audioUrl,
    isPlaying,
    isSending,
    duration,
    currentTime,
    error,
    toggleRecording,
    togglePlayback,
    handleSeek,
    handleSendAudio,
    handleDeleteAudio,
    onAudioLoadedMetadata,
    onAudioTimeUpdate,
    onAudioPlay,
    onAudioPause,
    onAudioEnded,
  } = useAudioWidget({ dialogId, uploadEndpoint, domain })

  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <RecordToggleButton
          isRecording={isRecording}
          buttonScale={buttonScale}
          onToggle={toggleRecording}
        />

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        {audioUrl ? (
          <AudioPreview
            audioRef={audioRef}
            audioUrl={audioUrl}
            isPlaying={isPlaying}
            isSending={isSending}
            duration={duration}
            currentTime={currentTime}
            onLoadedMetadata={onAudioLoadedMetadata}
            onTimeUpdate={onAudioTimeUpdate}
            onPlay={onAudioPlay}
            onPause={onAudioPause}
            onEnded={onAudioEnded}
            onTogglePlayback={togglePlayback}
            onSeek={handleSeek}
            onDelete={handleDeleteAudio}
            onSend={() => {
              void handleSendAudio()
            }}
          />
        ) : null}
      </div>
    </main>
  )
}

export default function BitrixImTextAreaPage() {
  return (
    <Suspense fallback={<main className="h-full p-2 text-slate-900 sm:p-3" />}>
      <BitrixImTextAreaContent />
    </Suspense>
  )
}
