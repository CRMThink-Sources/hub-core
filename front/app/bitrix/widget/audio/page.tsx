'use client'
import { BX24Script, getBitrixAppInfoFromUrl, useBX24 } from '@/bitrix'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import {
  parseBitrixDomain,
  resolveDialogId,
  resolveImbotIframeAuth,
} from './_lib/audio-widget-auth'
import { AudioPreview } from './_components/audio-preview'
import { RecordToggleButton } from './_components/record-toggle-button'
import { useAudioWidget } from './_hooks/use-audio-widget'

function BitrixImTextAreaContent() {
  const searchParams = useSearchParams()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { getAuth } = useBX24(scriptLoaded)

  const appInfo = useMemo(() => getBitrixAppInfoFromUrl(), [])
  const urlParams = appInfo.urlParams ?? {}
  const imbotAuth = useMemo(
    () => resolveImbotIframeAuth(urlParams),
    [urlParams],
  )
  const dialogId = useMemo(
    () => resolveDialogId(searchParams, urlParams),
    [searchParams, urlParams],
  )
  const rawDomain = searchParams.get('DOMAIN') ?? appInfo.domain ?? null
  const domain = rawDomain ? parseBitrixDomain(rawDomain) : null

  const uploadEndpoint = '/api/audio/upload'

  const {
    audioRef,
    isRecording,
    buttonScale,
    audioUrl,
    isPlaying,
    isSending,
    isSent,
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
  } = useAudioWidget({
    dialogId,
    uploadEndpoint,
    domain,
    imbotAuth,
    getAuth,
    urlParams,
  })

  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <RecordToggleButton
          isRecording={isRecording}
          buttonScale={buttonScale}
          onToggle={toggleRecording}
        />

        {isSent ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Audio enviado com sucesso!
          </p>
        ) : null}

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
