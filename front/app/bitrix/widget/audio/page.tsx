'use client'
import { B24FrameScript } from '@/bitrix/b24-frame-script'
import { getBitrixAppInfoFromUrl } from '@/bitrix'
import { useB24Frame } from '@/bitrix/use-b24-frame'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import {
  parseBitrixDomain,
  resolveDialogId,
  resolveImbotIframeAuth,
} from './_lib/audio-widget-auth'
import { uploadAudioViaB24Frame } from './_lib/upload-audio-via-b24-frame'
import { AudioPreview } from './_components/audio-preview'
import { RecordToggleButton } from './_components/record-toggle-button'
import { useAudioWidget } from './_hooks/use-audio-widget'

function BitrixImTextAreaContent() {
  const searchParams = useSearchParams()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const {
    ready: b24Ready,
    client: b24Client,
    error: b24Error,
  } = useB24Frame(scriptLoaded)

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

  const isImbotContext = Boolean(imbotAuth)
  const canUploadAsUser = Boolean(b24Ready && b24Client)

  const uploadAsCurrentUser = useMemo(
    () =>
      canUploadAsUser && b24Client
        ? async (params: {
            dialogId: string
            blob: Blob
            fileName: string
          }) => {
            await uploadAudioViaB24Frame(b24Client, params)
          }
        : undefined,
    [canUploadAsUser, b24Client],
  )

  /** Fallback server-side quando o SDK do iframe nao estiver pronto. */
  const uploadEndpoint = '/api/audio/upload'
  const sdkPending = isImbotContext && !canUploadAsUser && !b24Error

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
    imbotAuth: isImbotContext && b24Error ? imbotAuth : null,
    urlParams,
    uploadAsCurrentUser,
    sdkPending,
  })

  const displayError =
    error ?? b24Error ?? (sdkPending ? 'Conectando ao Bitrix24...' : null)

  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <B24FrameScript onLoad={() => setScriptLoaded(true)} />

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

        {displayError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {displayError}
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
